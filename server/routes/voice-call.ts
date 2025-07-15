import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { geminiService } from "../services/gemini";
import { sheetsService } from "../services/sheets";
import twilio from "twilio";
import { z } from "zod";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const fromNumber = process.env.TWILIO_FROM_NUMBER ?? "";
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? ""; // e.g. https://abcdef.ngrok.io

const twilioClient = twilio(accountSid, authToken);
const voiceName = "Polly.Aditi"; // Indian English female voice

const initiateCallSchema = z.object({
  phone: z.string().regex(/^\+91\d{10}$/),
  sessionId: z.string().optional(),
});

export function registerVoiceRoutes(app: Express) {
  // REST endpoint triggered from the UI to start a phone call
  app.post("/api/initiate-call", async (req: Request, res: Response) => {
    try {
      const { phone, sessionId: maybeSession } = initiateCallSchema.parse(req.body);
      const sessionId = maybeSession || Date.now().toString();

      // create or reuse conversation in memory
      let conversation = await storage.getConversationBySessionId(sessionId);
      if (!conversation) {
        conversation = await storage.createConversation({
          sessionId,
          transcript: [],
          leadScore: { budget: 0, authority: 0, need: 0, timeline: 0, overall: 0 },
          qualificationStatus: "in_progress",
        });
      }

      if (!publicBaseUrl) {
        return res.status(500).json({ message: "PUBLIC_BASE_URL env var not set" });
      }

      const call = await twilioClient.calls.create({
        to: phone,
        from: fromNumber,
        url: `${publicBaseUrl}/api/voice/answer?sessionId=${sessionId}`,
        method: "POST",
      });

      res.json({ success: true, callSid: call.sid, sessionId });
    } catch (error: any) {
      console.error("Initiate call error", error);
      res.status(400).json({ message: error.message ?? "Failed to initiate call" });
    }
  });

  // First webhook Twilio hits when the call is answered
  app.post("/api/voice/answer", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say({ voice: voiceName, language: "en-IN" }, "Hi! This is Alex, your AI sales assistant. How can I help you today?");
    const gather = twiml.gather({
      input: ["speech"],
      action: `/api/voice/process?sessionId=${sessionId}`,
      method: "POST",
      timeout: 3,
      speechTimeout: "auto",
    });

    res.type("text/xml").send(twiml.toString());
  });

  // Subsequent webhook that handles each user utterance
  app.post("/api/voice/process", async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      const userText = (req.body.SpeechResult as string) ?? "";

      if (!sessionId) {
        throw new Error("Missing sessionId");
      }

      // Store user message
      let conversation = await storage.getConversationBySessionId(sessionId);
      if (!conversation) {
        conversation = await storage.createConversation({
          sessionId,
          transcript: [],
          leadScore: { budget: 0, authority: 0, need: 0, timeline: 0, overall: 0 },
          qualificationStatus: "in_progress",
        });
      }

      await storage.addMessage({ conversationId: conversation.id, content: userText, isUser: true });

      const history = await storage.getMessagesByConversationId(conversation.id);

      const aiResponse = await geminiService.generateResponse({
        message: userText,
        sessionId,
        conversationHistory: history.map((m) => ({ content: m.content, isUser: m.isUser })),
      });

      await storage.addMessage({ conversationId: conversation.id, content: aiResponse.response, isUser: false });

      // update lead score / contact info
      const updatedLeadScore = { ...(conversation.leadScore as any), ...(aiResponse.leadScore as any) };
      const updatedContactInfo = { ...(conversation.contactInfo as any), ...(aiResponse.contactInfo as any) };
      await storage.updateConversation(conversation.id, { leadScore: updatedLeadScore, contactInfo: updatedContactInfo });

      // log to Google Sheets
      await sheetsService.logConversation({
        sessionId,
        userMessage: userText,
        aiResponse: aiResponse.response,
        leadScore: updatedLeadScore,
        contactInfo: updatedContactInfo,
        timestamp: new Date(),
      });

      // Build TwiML response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: voiceName, language: "en-IN" }, aiResponse.response);

      // Continue the gather loop unless qualificationStatus is call_booked or caller hangs up
      const gather = twiml.gather({
        input: ["speech"],
        action: `/api/voice/process?sessionId=${sessionId}`,
        method: "POST",
        timeout: 3,
        speechTimeout: "auto",
      });

      res.type("text/xml").send(twiml.toString());
    } catch (error: any) {
      console.error("Voice process error", error);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: voiceName, language: "en-IN" }, "I\'m sorry, something went wrong. Goodbye.");
      twiml.hangup();
      res.type("text/xml").send(twiml.toString());
    }
  });
}

import 'dotenv/config';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

(async () => {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: 'VoiceBot-Conversations' },
      },
    });
    console.log('NEW_SHEET_ID=' + res.data.spreadsheetId);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

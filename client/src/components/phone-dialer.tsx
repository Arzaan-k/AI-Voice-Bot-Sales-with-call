import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhoneDialerProps {
  sessionId: string;
}

export function PhoneDialer({ sessionId }: PhoneDialerProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("+91");
  const [status, setStatus] = useState<"idle" | "calling" | "in-call" | "completed">("idle");

  const initiateCallMutation = useMutation({
    mutationFn: async (data: { phone: string; sessionId: string }) => {
      const res = await apiRequest("POST", "/api/initiate-call", data);
      return res.json();
    },
    onMutate: () => setStatus("calling"),
    onSuccess: () => {
      toast({ title: "Call initiated!", description: "Ringing the prospect…" });
      setStatus("in-call");
    },
    onError: (err: any) => {
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
      setStatus("idle");
    },
  });

  const handleStartCall = () => {
    const trimmed = phone.replace(/\s+/g, "");
    if (!/^\+91\d{10}$/.test(trimmed)) {
      toast({ title: "Invalid number", description: "Enter 10-digit Indian mobile with +91" });
      return;
    }
    initiateCallMutation.mutate({ phone: trimmed, sessionId });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-neutral-900">Phone Call</h3>
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium text-neutral-700">
          Prospect Number
        </Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
          maxLength={13}
        />
      </div>
      <Button className="w-full bg-primary text-white" onClick={handleStartCall} disabled={status === "calling" || initiateCallMutation.isPending}>
        {status === "calling" || initiateCallMutation.isPending ? "Calling…" : "Start Call"}
      </Button>
      {status === "in-call" && <p className="text-sm text-neutral-600 text-center">Call in progress…</p>}
      {status === "completed" && <p className="text-sm text-neutral-600 text-center">Call ended.</p>}
    </div>
  );
}

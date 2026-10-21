"use client";
import type { NextPage } from "next";
import Link from "next/link";
import { useRef, useState } from "react";
import { createFavour } from "./actions";

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M10 8V4l-8 8 8 8v-4.1c5.6 0 9.5 1.8 12 5.6-1-6-4.6-10.9-12-11.5z" />
  </svg>
);

const HandIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M8 3a1.5 1.5 0 0 1 3 0v6h1V2.5a1.5 1.5 0 0 1 3 0V9h1V4.5a1.5 1.5 0 0 1 3 0V15c0 4-3 7-7 7h-1c-3 0-5-1.6-6.6-4.2L2.6 14.2a1.5 1.5 0 0 1 2.5-1.6L6 13.8V5.5a1.5 1.5 0 0 1 2-1.4V3z" />
  </svg>
);

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z" />
  </svg>
);

const DashboardAskAFavourPage1: NextPage = () => {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // True while the button is held; lets a quick release cancel a pending start.
  const activeRef = useRef(false);

  const baseTextRef = useRef("");
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");

  const startRecording = async () => {
    if (activeRef.current) return;
    activeRef.current = true;

    setError("");
    setStatus("Requesting microphone access...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access requires HTTPS or localhost."
        );
      }

      // Request microphone permission.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      // Obtain a short-lived Deepgram token from our backend.
      const tokenResponse = await fetch("/api/deepgram-token", {
        method: "POST",
      });

      if (!tokenResponse.ok) {
        throw new Error("Could not authenticate with Deepgram.");
      }

      const { access_token } = await tokenResponse.json();

      // Open a real-time transcription connection.
      const socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen" +
          "?model=nova-3" +
          "&language=en" +
          "&smart_format=true" +
          "&interim_results=true",
        ["bearer", access_token]
      );

      socketRef.current = socket;

      baseTextRef.current = requestText.trimEnd();
      finalTextRef.current = "";
      interimTextRef.current = "";

      const renderTranscript = () => {
        const parts = [
          baseTextRef.current,
          finalTextRef.current,
          interimTextRef.current,
        ].filter((part) => part.length > 0);

        setRequestText(parts.join(" "));
      };

      socket.onopen = () => {
        // Button was released before the connection was ready.
        if (!activeRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          socket.close();
          return;
        }

        try {
          const recorder = new MediaRecorder(stream);
          recorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (
              event.data.size > 0 &&
              socket.readyState === WebSocket.OPEN
            ) {
              socket.send(event.data);
            }
          };

          recorder.onerror = () => {
            setError("An error occurred while recording audio.");
          };

          recorder.start(250);
          setRecording(true);
          setStatus("Listening... Release the button to stop.");
        } catch {
          setError("Could not start audio recording.");
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          socket.close();
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          const transcript =
            data.channel?.alternatives?.[0]?.transcript;

          if (!transcript) return;

          if (data.is_final) {
            finalTextRef.current +=
              (finalTextRef.current ? " " : "") + transcript;
            interimTextRef.current = "";
          } else {
            interimTextRef.current = transcript;
          }

          renderTranscript();
        } catch {
          // Ignore messages that are not transcript results.
        }
      };

      socket.onerror = () => {
        setError("Deepgram connection failed. Please try again.");
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          setStatus("");
        }
      };
    } catch (err) {
      activeRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start speech recognition."
      );
      setStatus("");
    }
  };

  const stopRecording = () => {
    if (!activeRef.current) return;
    activeRef.current = false;

    const recorder = recorderRef.current;
    const socket = socketRef.current;

    // Stop the microphone and recorder.
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setRecording(false);
    setStatus("Finishing transcription...");

    // Send the last audio chunk, then CloseStream. Deepgram flushes the
    // final transcripts and closes the socket itself; onclose clears status.
    if (socket && socket.readyState === WebSocket.OPEN) {
      const finish = () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "CloseStream" }));
        }

        // Fallback in case Deepgram never closes the connection.
        window.setTimeout(() => socket.close(), 5000);
      };

      if (recorder && recorder.state === "recording") {
        recorder.addEventListener("stop", finish, { once: true });
      } else {
        finish();
      }
    } else {
      socket?.close();
      socketRef.current = null;
      setStatus("");
    }
  };

  const [requestText, setRequestText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendRequest = async () => {
    setSending(true);
    setMessage("");

    try {
      const { error } = await createFavour(requestText);
      if (error) {
        setMessage(error);
        return;
      }

      setRequestText("");
      setMessage("Your request has been sent to your neighbours.");
    } catch {
      setMessage("Failed to submit your request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f7f9f6] text-[#0b1322] [font-family:Metropolis,ui-sans-serif,system-ui,sans-serif]">
      <div className="grid h-4 w-full grid-cols-4">
        <div className="bg-[#d71920]" />
        <div className="bg-[#f15a22]" />
        <div className="bg-[#f58220]" />
        <div className="bg-[#fcaf17]" />
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="m-0 text-4xl font-bold md:text-5xl">
            Ask a Favour
          </h1>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-[#e6e4df] bg-white px-8 py-4 text-xl font-bold text-[#0b1322] no-underline hover:bg-[#e6e6e6] md:text-2xl"
            >
              <BackIcon /> Back
            </Link>

            <Link
              href="/ask-a-favour/check-requests"
              className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-[#e6e4df] bg-white px-8 py-4 text-xl font-bold text-[#0b1322] no-underline hover:bg-[#e6e6e6] md:text-2xl"
            >
              <HandIcon /> Check Requests
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 rounded-[30px] border border-[#e6e4df] bg-white p-6">
          <h2 className="m-0 text-3xl font-bold md:text-4xl">
            What do you need help?
          </h2>

          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            maxLength={2000}
            className="min-h-[160px] w-full flex-1 resize-none rounded-[14px] border border-[#e6e4df] bg-[#f7f9f6] p-4 text-xl text-[#0b1322] outline-none [font-family:inherit] placeholder:text-[#777] focus:border-[#ccc9c7] md:text-2xl"
            placeholder="I need help with getting my medicine from the Almara Pharmacy..."
          />

          {status && (
            <p role="status" className="m-0 text-sm text-gray-600">
              {status}
            </p>
          )}

          {message && (
            <p role="status" className="m-0 text-lg font-semibold">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="m-0 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="grid grid-cols-[1.85fr_1fr] gap-3">
            <button
              type="button"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                void startRecording();
              }}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              onPointerCancel={stopRecording}
              onContextMenu={(event) => event.preventDefault()}
              className={`flex touch-none cursor-pointer select-none items-center justify-center gap-2 rounded-[14px] border-none py-5 text-2xl font-bold text-white ${
                recording
                  ? "bg-[#a50f16]"
                  : "bg-[#d71920] hover:bg-[#fc4047]"
              }`}
            >
              <MicIcon />
              {recording ? "Listening..." : "Hold to Speak"}
            </button>

            <button
              type="button"
              onClick={handleSendRequest}
              disabled={sending}
              className="cursor-pointer rounded-[14px] border-none bg-[#0b1322] py-5 text-2xl font-bold text-white hover:bg-[#1c2a44] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send Request"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardAskAFavourPage1;

import React, { useState } from "react";
import { MessageCircle, X, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AIChat from "./AIChat";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg flex items-center justify-center hover:bg-primary-600 transition-all z-50"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat Popup */}
      {open && (
        <div className="fixed bottom-6 right-6 w-80 h-96 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-50 flex flex-col animate-slide-up">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <h3 className="text-white font-semibold">AI Assistant</h3>

            <div className="flex items-center gap-3">
              {/* Expand → Redirect to /chat */}
              <button
                onClick={() => navigate("/chat")}
                className="text-slate-300 hover:text-white"
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              {/* Close Popup */}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Box */}
          <div className="flex-1 overflow-hidden">
            <AIChat />
          </div>
        </div>
      )}
    </>
  );
}

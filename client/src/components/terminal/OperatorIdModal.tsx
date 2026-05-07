import React, { useState, useRef, useEffect } from "react";

interface OperatorIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (operatorId: string) => void;
}

const OperatorIdModal: React.FC<OperatorIdModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [operatorId, setOperatorId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // setTimeout modal açılma animasyonuna vakit tanımak için
      setTimeout(() => {
        setOperatorId("");
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (operatorId.trim()) {
      onSubmit(operatorId.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-foreground/70 backdrop-blur-sm p-4">
      <div className="bg-card border-[3px] border-primary rounded-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* HEADER */}
        <div className="bg-primary py-4 text-center">
          <h2 className="text-3xl font-black text-primary-foreground tracking-widest uppercase">
            OPERATOR ID
          </h2>
        </div>

        {/* BODY */}
        <form
          onSubmit={handleSubmit}
          className="p-12 flex flex-col items-center gap-10"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Operator ID"
            className="w-full text-center text-3xl py-4 px-6 bg-background border-2 border-primary rounded-xl text-foreground font-bold"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          />

          <button
            type="button"
            onClick={onClose}
            className="bg-foreground hover:bg-foreground/80 text-card font-black py-4 px-16 rounded-xl transition-all duration-300 uppercase tracking-widest text-lg active:scale-95"
          >
            Kapat
          </button>
        </form>
      </div>
    </div>
  );
};

export default OperatorIdModal;

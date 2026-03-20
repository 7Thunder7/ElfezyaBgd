// src/hooks/useModal.ts
import { useContext } from "react";
import { ModalContext } from "../contexts/modal";

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error("useModal must be used within ModalProvider");
    return ctx;
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authSchemas, type AuthAction } from "@/lib/auth-contracts";
const labels: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  password: "Senha",
  password_confirmation: "Confirme a senha",
  token: "Token recebido por e-mail",
};
const fields: Record<AuthAction, string[]> = {
  register: ["name", "email", "password", "password_confirmation"],
  login: ["email", "password"],
  verify: ["token"],
  forgot: ["email"],
  reset: ["token", "password", "password_confirmation"],
  profile: ["name"],
  delete: ["password"],
  logout: [],
  rotate: [],
};
const buttons: Record<AuthAction, string> = {
  register: "Criar conta",
  login: "Entrar",
  verify: "Verificar e-mail",
  forgot: "Enviar instruções",
  reset: "Redefinir senha",
  profile: "Salvar nome",
  delete: "Excluir minha conta permanentemente",
  logout: "Sair da conta",
  rotate: "Renovar sessão",
};
export function AuthenticationForm({
  action,
  initialName,
}: {
  action: AuthAction;
  initialName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);
  const router = useRouter();
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        const raw = Object.fromEntries(new FormData(form));
        const parsed = authSchemas[action].safeParse(raw);
        if (!parsed.success) {
          setInvalid(true);
          setMessage(parsed.error.issues.map((i) => i.message).join(" "));
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          const res = await fetch(`/api/session/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });
          const data = await res.json();
          setInvalid(!res.ok);
          setMessage(data.message);
          if (res.ok) {
            form.reset();
            if (["login", "logout", "delete"].includes(action))
              router.push(action === "login" ? "/conta" : "/auth/login");
            router.refresh();
          }
        } catch {
          setInvalid(true);
          setMessage("Não foi possível conectar. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields[action].map((field) => (
        <label key={field}>
          <span>{labels[field]}</span>
          {field === "token" ? (
            <textarea
              name={field}
              required
              maxLength={4096}
              autoComplete="off"
              rows={4}
            />
          ) : (
            <input
              name={field}
              defaultValue={field === "name" ? initialName : undefined}
              type={
                field.includes("password")
                  ? "password"
                  : field === "email"
                    ? "email"
                    : "text"
              }
              autoComplete={
                field === "password"
                  ? action === "login" || action === "delete"
                    ? "current-password"
                    : "new-password"
                  : field === "password_confirmation"
                    ? "new-password"
                    : field
              }
              required
              maxLength={
                field.includes("password") ? 500 : field === "name" ? 120 : 254
              }
              minLength={
                field.includes("password") &&
                ["register", "reset"].includes(action)
                  ? 12
                  : undefined
              }
            />
          )}
        </label>
      ))}
      {["register", "reset"].includes(action) && (
        <p className="fineprint">
          Use pelo menos 12 caracteres e no máximo 72 bytes. Caracteres
          acentuados podem ocupar mais de um byte.
        </p>
      )}
      {action === "delete" && (
        <label className="confirm-delete">
          <input type="checkbox" required /> Entendo que esta exclusão é
          permanente.
        </label>
      )}
      <button
        type="submit"
        disabled={busy}
        className={`button ${action === "delete" ? "danger" : "primary"}`}
      >
        {busy ? "Aguarde…" : buttons[action]}
      </button>
      <p
        role={invalid ? "alert" : "status"}
        aria-live="polite"
        className={invalid ? "form-error" : "form-success"}
      >
        {message}
      </p>
      {action === "login" && invalid && message.includes("verificado") && (
        <Link href="/auth/verify">Confirmar meu e-mail</Link>
      )}
    </form>
  );
}

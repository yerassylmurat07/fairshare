import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  changePasswordSchema,
  authFieldErrors,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "../../shared/auth";
import { api, ApiError, message } from "../lib/api";
import { Modal, Button, ErrorBox } from "../components/ui";

const passwordFields = [
  {
    name: "currentPassword",
    label: "Текущий пароль",
    autocomplete: "current-password",
  },
  { name: "newPassword", label: "Новый пароль", autocomplete: "new-password" },
  {
    name: "confirmPassword",
    label: "Повторите новый пароль",
    autocomplete: "new-password",
  },
] as const;

export function ChangePasswordDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  function focusError(fields: Record<string, string>) {
    requestAnimationFrame(() => {
      const field = passwordFields.find((f) => fields[f.name]);
      const input = field && form.current?.elements.namedItem(field.name);
      if (input instanceof HTMLElement) input.focus();
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const parsed = changePasswordSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      const fields = authFieldErrors(parsed.error.issues);
      setErrors(fields);
      setError("Проверьте выделенные поля.");
      focusError(fields);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    setErrors({});
    try {
      await api("/auth/password", { method: "POST", body: parsed.data });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        focusError(e.fieldErrors);
      }
      setError(
        e instanceof TypeError
          ? "Нет соединения с сервером. Проверьте интернет и попробуйте снова."
          : message(e),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Сменить пароль"
      onClose={() => {
        if (!submitting.current) onClose();
      }}
    >
      <p className="modal-description">
        После смены пароля остальные сеансы завершатся. Здесь вы останетесь в
        аккаунте.
      </p>
      <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset className="auth-fields" disabled={busy}>
          <legend className="sr-only">Смена пароля</legend>
          {passwordFields.map(({ name, label, autocomplete }) => (
            <div className="auth-password-field" key={name}>
              <label htmlFor={`change-${name}`}>{label}</label>
              <div className="auth-password-input">
                <input
                  id={`change-${name}`}
                  name={name}
                  type={visible[name] ? "text" : "password"}
                  autoComplete={autocomplete}
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  minLength={
                    name === "newPassword" ? MIN_PASSWORD_LENGTH : undefined
                  }
                  maxLength={MAX_PASSWORD_LENGTH}
                  aria-invalid={!!errors[name]}
                  aria-describedby={
                    errors[name]
                      ? `change-${name}-error`
                      : name === "newPassword"
                        ? "change-password-hint"
                        : undefined
                  }
                  onChange={() => {
                    setErrors((current) => ({ ...current, [name]: "" }));
                    setError("");
                  }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={`${visible[name] ? "Скрыть" : "Показать"}: ${label.toLowerCase()}`}
                  aria-controls={`change-${name}`}
                  aria-pressed={!!visible[name]}
                  onClick={() =>
                    setVisible((current) => ({
                      ...current,
                      [name]: !current[name],
                    }))
                  }
                >
                  {visible[name] ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {name === "newPassword" && (
                <p className="auth-field-hint" id="change-password-hint">
                  От 15 до 128 символов. Можно использовать несколько слов с
                  пробелами.
                </p>
              )}
              {errors[name] && (
                <small className="auth-field-error" id={`change-${name}-error`}>
                  {errors[name]}
                </small>
              )}
            </div>
          ))}
        </fieldset>
        <ErrorBox error={error} />
        <div className="modal-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button type="submit" busy={busy}>
            Сохранить пароль
          </Button>
        </div>
      </form>
    </Modal>
  );
}

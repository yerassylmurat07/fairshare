import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { X, Equal, LoaderCircle, AlertCircle } from "lucide-react";
import type { User } from "../../shared/types";
export function Avatar({
  user,
  small = false,
}: {
  user: Pick<User, "initials" | "color" | "name">;
  small?: boolean;
}) {
  return (
    <span
      className={"avatar" + (small ? " small" : "")}
      title={user.name}
      style={{ background: user.color + "20", color: user.color }}
    >
      {user.initials}
    </span>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <Equal size={31} strokeWidth={4} />
      <div>
        <strong>FairShare</strong>
        <span>Balanced teamwork</span>
      </div>
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={"button " + variant + " " + (props.className || "")}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      {error}
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = ref.current;
    root?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && root) {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ),
        ).filter((e) => e.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === root)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export const hours = (n: number) =>
  Number(n.toFixed(2)).toLocaleString("en-US");
export function Progress({
  value,
  capacity,
}: {
  value: number;
  capacity: number;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Planned workload"
      aria-valuemin={0}
      aria-valuemax={Math.max(capacity, value, 1)}
      aria-valuenow={value}
    >
      <span
        className={value > capacity ? "overload" : ""}
        style={{
          width:
            Math.min(
              capacity ? (value / capacity) * 100 : value ? 100 : 0,
              100,
            ) + "%",
        }}
      />
    </div>
  );
}

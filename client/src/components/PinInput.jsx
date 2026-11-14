// Masked numeric PIN box, like the UPI PIN screen
export default function PinInput({ value, onChange, length = 4, autoFocus }) {
  return (
    <input
      className="pin"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      placeholder={"•".repeat(length)}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      aria-label="Payment PIN"
    />
  )
}

type ErrorMessageProps = {
  children?: string;
};

export function ErrorMessage({ children }: ErrorMessageProps) {
  if (!children) return null;
  return <p className="text-xs text-red-400 mt-1">{children}</p>;
}

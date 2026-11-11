export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className ?? "text-sm text-ink-2 hover:text-ink"}>
        Sign out
      </button>
    </form>
  );
}

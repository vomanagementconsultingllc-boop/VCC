export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={
          className ??
          "flex h-11 items-center whitespace-nowrap rounded-full px-3.5 text-[15px] text-ink/65 transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink"
        }
      >
        Sign out
      </button>
    </form>
  );
}

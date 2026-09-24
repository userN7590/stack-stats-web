"use client";
export default function ConnectionError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl space-y-5 p-10"><h1>Connection temporarily unavailable</h1><p>Local editor tracking is unaffected. Try again when your account service is available.</p><button onClick={reset}>Try again</button></main>;
}

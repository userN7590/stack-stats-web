import type { BackgroundStyle } from "@/lib/appearance";

type ProfileBackgroundProps = {
  style: BackgroundStyle;
  mode?: "profile" | "preview";
};

export function ProfileBackground({
  style,
  mode = "profile",
}: ProfileBackgroundProps) {
  if (style === "none") return null;

  const isPreview = mode === "preview";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {style === "aurora" && (
        <>
          <div
            className={
              isPreview
                ? "absolute -right-10 -top-12 size-52 rounded-full bg-[#4d8dcc]/35 blur-3xl"
                : "absolute -right-32 -top-40 size-[32rem] rounded-full bg-[#4d8dcc]/[0.075] blur-[110px] sm:size-[44rem]"
            }
          />
          <div
            className={
              isPreview
                ? "absolute -bottom-20 -left-8 size-48 rounded-full bg-[#7957a8]/30 blur-3xl"
                : "absolute -left-40 top-[38rem] size-[28rem] rounded-full bg-[#7957a8]/[0.05] blur-[120px] sm:size-[38rem]"
            }
          />
        </>
      )}

      {style === "signal" && (
        <>
          <div
            className={
              isPreview
                ? "absolute -right-16 top-3 h-28 w-72 rotate-[-13deg] rounded-[50%] border border-[#55a7ff]/45"
                : "absolute -right-56 top-48 h-[28rem] w-[42rem] rotate-[-13deg] rounded-[50%] border border-[#55a7ff]/[0.075]"
            }
          />
          <div
            className={
              isPreview
                ? "absolute -right-24 top-10 h-36 w-80 rotate-[-13deg] rounded-[50%] border border-[#a58bd4]/30"
                : "absolute -right-72 top-64 h-[34rem] w-[52rem] rotate-[-13deg] rounded-[50%] border border-[#a58bd4]/[0.05]"
            }
          />
          <div
            className={
              isPreview
                ? "absolute -left-8 bottom-6 h-px w-56 rotate-[18deg] bg-[#55a7ff]/40"
                : "absolute -left-32 top-[52rem] h-px w-[34rem] rotate-[18deg] bg-[#55a7ff]/[0.055]"
            }
          />
        </>
      )}

      {style === "blueprint" && (
        <div
          className={`absolute inset-0 ${isPreview ? "opacity-25" : "opacity-[0.035]"}`}
          style={{
            backgroundImage:
              "linear-gradient(rgba(85,167,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(85,167,255,0.7) 1px, transparent 1px)",
            backgroundSize: isPreview ? "20px 20px" : "42px 42px",
            maskImage:
              isPreview
                ? "linear-gradient(to bottom, black, rgba(0,0,0,0.35))"
                : "linear-gradient(to bottom, black, transparent 82%)",
          }}
        />
      )}

      {style === "ember" && (
        <>
          <div
            className={
              isPreview
                ? "absolute -right-12 -top-10 size-56 rounded-full bg-[#b94e38]/35 blur-3xl"
                : "absolute -right-40 top-24 size-[34rem] rounded-full bg-[#b94e38]/[0.06] blur-[120px] sm:size-[46rem]"
            }
          />
          <div
            className={
              isPreview
                ? "absolute -bottom-20 left-8 size-44 rounded-full bg-[#d88a45]/25 blur-3xl"
                : "absolute -left-32 top-[48rem] size-[24rem] rounded-full bg-[#d88a45]/[0.035] blur-[110px]"
            }
          />
        </>
      )}
    </div>
  );
}

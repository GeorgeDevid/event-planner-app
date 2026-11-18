import localFont from "next/font/local";

// Self-hosted from npm (@fontsource) so builds don't depend on Google Fonts.
export const jakarta = localFont({
  src: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const cormorant = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2",
      weight: "600",
    },
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

import type { Metadata } from "next";
import {
	Courier_Prime,
	JetBrains_Mono,
	Press_Start_2P,
} from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const pressStart = Press_Start_2P({
	variable: "--font-press-start",
	subsets: ["latin"],
	weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
	variable: "--font-jetbrains-mono",
	subsets: ["latin"],
	weight: ["400", "500", "700"],
});

const courierPrime = Courier_Prime({
	variable: "--font-courier-prime",
	subsets: ["latin"],
	weight: ["400", "700"],
});

export const metadata: Metadata = {
	title: "Arcade Vault · Portal Retro",
	description:
		"Plataforma para jugar online y competir por la mayor cantidad de puntos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="es"
			className={`${pressStart.variable} ${jetbrainsMono.variable} ${courierPrime.variable} h-full`}
		>
			<body className="min-h-full">
				<div className="av-bg" />
				<div className="av-noise" />
				<div className="av-root">
					<SessionProvider>
						{/* usePathname puede suspender con cacheComponents */}
						<Suspense fallback={null}>
							<Nav />
						</Suspense>
						<main className="av-main">{children}</main>
						<Footer />
					</SessionProvider>
				</div>
			</body>
		</html>
	);
}

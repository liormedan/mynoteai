"use client";

import dynamic from "next/dynamic";

// BlockNote touches the DOM on creation, so it must never render on the server.
export const Editor = dynamic(() => import("./editor"), { ssr: false });

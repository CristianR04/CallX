import { NextResponse } from "next/server";
import DigestFetch from "digest-fetch";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CONFIG = {
  username: "admin",
  password: "Tattered3483",
  deviceIp: "172.31.7.125",
};

const client = new DigestFetch(CONFIG.username, CONFIG.password, { algorithm: "MD5" });

export async function GET() {
  try {
    // 1. Intentar formato JSON (modelos modernos)
    const jsonUrl = `https://${CONFIG.deviceIp}/ISAPI/AccessControl/AcsEvent?format=json`;

    const jsonRes = await client.fetch(jsonUrl, { method: "GET" });

    if (jsonRes.ok) {
      const json = await jsonRes.json().catch(() => null);

      if (json) {
        return NextResponse.json({
          modo: "json",
          eventos: json,
        });
      }
    }

    // 2. Intentar XML (algunos modelos antiguos)
    const xmlUrl = `https://${CONFIG.deviceIp}/ISAPI/AccessControl/AcsEvent`;

    const xmlRes = await client.fetch(xmlUrl, { method: "GET" });

    if (xmlRes.ok) {
      const xmlText = await xmlRes.text();
      if (!xmlText.includes("invalidOperation")) {
        return NextResponse.json({
          modo: "xml",
          xml: xmlText,
        });
      }
    }

    // 3. Fallback DEFINITIVO → alertStream (tu modelo)
    const streamUrl = `https://${CONFIG.deviceIp}/ISAPI/Event/notification/alertStream`;

    const streamRes = await client.fetch(streamUrl, { method: "GET" });

    if (!streamRes.ok) {
      throw new Error("El dispositivo no soporta JSON ni XML, y alertStream falló");
    }

    const reader = streamRes.body.getReader();

    return new Response(
      new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        },
      }),
      {
        headers: {
          "Content-Type": "multipart/x-mixed-replace; boundary=--boundary",
        },
      }
    );

  } catch (error) {
    console.error("Error en /api/eventos:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

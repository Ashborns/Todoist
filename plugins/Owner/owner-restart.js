const handler = async (m, { isROwner }) => {
  if (!process.send) throw "Dont: node main.js\nDo: node index.js";

  // Memanggil reloadHandler tanpa memeriksa status koneksi
  try {
    await reloadHandler(true); // Reload handler tanpa restart program
    m.reply("```H A N D L E R   D I P E R B A R U I . . .```");
  } catch (error) {
    console.error("Error saat reload handler:", error);
    m.reply("Terjadi kesalahan saat mereload handler.");
  }
};

handler.help = ["restart"];
handler.tags = ["owner"];
handler.command = /^(res(tart)?)$/i;
handler.rowner = true;

export default handler;

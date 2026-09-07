export default async function run(page) {
  await page.waitForTimeout(300);
  return await page.evaluate(() => {
    const out = { sheets: [], rules: [] };
    for (const s of document.styleSheets) {
      out.sheets.push({ href: s.href || "(inline)", rules: s.cssRules ? s.cssRules.length : -1 });
      try {
        for (const r of s.cssRules) {
          if (r.selectorText && r.selectorText.includes("data-theme")) out.rules.push(r.selectorText);
        }
      } catch (e) { out.rules.push("ERR:" + e.message); }
    }
    return out;
  });
}
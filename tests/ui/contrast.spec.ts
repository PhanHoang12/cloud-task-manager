import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test, type Locator } from "@playwright/test";

const cases: [string, string, string, number?][] = [["Statistic label","#personal .stat-title","#8290a2"],["Statistic footnote","#personal .stat-foot","#9aa4b2"],["Personal subtitle","#personal .subtitle","#8490a2"],["Personal section description","#personal .section-head p","#8490a2"],["Personal task description","#personal .task p","#8491a2"],["Workspace description","#workspace .ws-heading .ws-muted","#5e6d83"],["Project section description","#workspace .ws-section-head p","#5e6d83"],["Project description","#workspace .ws-project-card > p","#7a8599"],["Overview chart description","#workspace .wo-chart-heading p","#728099"],["Violet metric supporting text","#workspace .wo-violet > small","#728099"],["Indigo metric supporting text","#workspace .wo-indigo > small","#728099"],["Blue metric supporting text","#workspace .wo-blue > small","#728099"],["Green metric supporting text","#workspace .wo-green > small","#728099"],["Kanban project description","#kanban .kb-header p","#7786a0"],["Kanban task description","#kanban .kb-card > p","#74829c"],["Kanban task metadata","#kanban .kb-details","#8492a8"],["Member email","#members .tm-member-email","#828793"],["Comment timestamp","#kanban .tc-time","#94a3b8"],["Large personal statistic","#personal .stat > strong","#202c42",3]];
type Pair = { foreground: string; backgrounds: string[]; opacity: number; fontSize: string };

function luminance(color: string) {
  const rgb = color.startsWith("#")
    ? color.slice(1).match(/../g)!.map(value => parseInt(value, 16))
    : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const linear = rgb.map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

async function readPair(locator: Locator): Promise<Pair> {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    let opacity = 1;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      opacity *= Number(getComputedStyle(ancestor).opacity);
    }
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const background = getComputedStyle(ancestor);
      if (background.backgroundImage !== "none") {
        // These incumbent gradients have opaque, monotonic white-to-tint stops.
        // The minimum endpoint ratio is a conservative bound over the full gradient.
        const colors = background.backgroundImage.match(/rgba?\([^)]+\)/g);
        if (!background.backgroundImage.startsWith("linear-gradient") || !colors?.length ||
          colors.some(color => color.startsWith("rgba") && Number(color.match(/[\d.]+/g)![3]) !== 1)) {
          throw new Error("Unsupported background image: " + background.backgroundImage);
        }
        return { foreground: style.color, backgrounds: colors, opacity, fontSize: style.fontSize };
      }
      const color = background.backgroundColor;
      const channels = color.match(/[\d.]+/g)!.map(Number);
      if (channels.length === 3 || channels[3] === 1) {
        return { foreground: style.color, backgrounds: [color], opacity, fontSize: style.fontSize };
      }
      if (channels[3] !== 0) throw new Error("Unsupported translucent background: " + color);
    }
    throw new Error("No opaque background found");
  });
}

test("H2 text contrast meets AA on computed backgrounds and interaction states", async ({ page }, testInfo) => {
  await page.goto("/tests/ui/contrast-fixture.html");
  await page.locator("#personal .stat-title").waitFor();
  await page.locator(".wo-analytics > summary").click();
  const report: { label: string; state: string; foreground: string; backgrounds: string[]; before: number; after: number; minimum: number }[] = [];
  for (const [label, selector, oldColor, minimum = 4.5] of cases) {
    const target = page.locator(selector).first();
    // M9 hides only secondary overview copy at the mobile breakpoint.
    if (testInfo.project.name === "mobile-viewport" && (selector === "#workspace .ws-section-head p" || selector.startsWith("#workspace .wo-") && selector.endsWith(" > small"))) {
      await expect(target).toBeHidden();
      continue;
    }
    const states = ["rest", "hover", "focus-within", "active", "selected"];
    const interactive = target.locator("xpath=ancestor-or-self::*[self::button or @draggable or contains(concat(' ', normalize-space(@class), ' '), ' ws-project-card ') or contains(concat(' ', normalize-space(@class), ' '), ' tm-member-row ') or contains(concat(' ', normalize-space(@class), ' '), ' task ')][1]");
    const hasInteractive = await interactive.count() > 0;
    for (const state of states) {
      if (state !== "rest" && !hasInteractive) continue;
      if (state === "hover") await interactive.hover();
      if (state === "focus-within") {
        await page.keyboard.press("Tab");
        const control = await interactive.evaluate(element => {
          const focusTarget = element.matches("button") ? element : element.querySelector<HTMLElement>("button, select, input");
          (focusTarget as HTMLElement | null)?.focus();
          return !!focusTarget;
        });
        if (!control) continue;
      }
      if (state === "active") {
        await interactive.hover();
        await page.mouse.down();
      }
      if (state === "selected") {
        const isMetric = await interactive.evaluate(element => element.matches("button.wo-metric"));
        if (!isMetric) continue;
        if (await interactive.getAttribute("aria-pressed") !== "true") await interactive.click();
        await expect(interactive).toHaveAttribute("aria-pressed", "true");
      }
      const pair = await readPair(target);
      expect(pair.opacity, label + " has no opacity attenuation").toBe(1);
      report.push({
        label, state, foreground: pair.foreground, backgrounds: pair.backgrounds,
        before: Math.min(...pair.backgrounds.map(background => contrast(oldColor, background))),
        after: Math.min(...pair.backgrounds.map(background => contrast(pair.foreground, background))),
        minimum,
      });
      if (state === "active") await page.mouse.up();
    }
  }
  const reportPath = testInfo.outputPath("contrast-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await testInfo.attach("contrast-report", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  const failures = report.filter(row => row.after < row.minimum);
  expect(failures, "Unrounded contrast ratios must meet each threshold").toEqual([]);
  for (const section of ["personal", "workspace", "kanban"]) {
    await page.locator("#" + section).screenshot({ path: testInfo.outputPath(section + "-contrast.png") });
  }
});

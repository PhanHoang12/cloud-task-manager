import { expect, test, type Locator } from "@playwright/test";

async function appearance(wrapper: Locator) {
  return wrapper.evaluate(element => {
    const style = getComputedStyle(element);
    function background(start: Element | null): string {
      for (let node = start; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        const channels = color.match(/[\d.]+/g)!.map(Number);
        if (channels.length === 3 || channels[3] === 1) return color;
        if (channels[3] !== 0) throw new Error("Unexpected translucent search background");
      }
      throw new Error("No opaque search background");
    }
    return {
      width: style.outlineWidth, style: style.outlineStyle, offset: style.outlineOffset,
      color: style.outlineColor, background: background(element),
      canvasBackground: background(document.getElementById("canvas")),
      border: style.borderWidth, padding: style.padding,
    };
  });
}
function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
for (const kind of ["personal", "workspace"]) {
  for (const surface of ["panel", "canvas"]) {
    test(`H3 ${kind} search has visible keyboard focus without layout shift on ${surface}`, async ({ page }, testInfo) => {
      await page.goto(`/tests/ui/search-focus-fixture.html?kind=${kind}&surface=${surface}`);
      await page.evaluate(() => document.fonts.ready);
      const input = page.getByRole("textbox", { name: kind === "personal" ? "Tìm công việc" : "Tìm dự án", exact: true });
      const wrapper = page.getByTestId("search-wrapper");
      const before = page.getByRole("button", { name: "Trước tìm kiếm", exact: true });
      const after = page.getByRole("button", { name: "Sau tìm kiếm", exact: true });
      await before.focus();
      const resting = await appearance(wrapper);
      const box = await wrapper.boundingBox();
      const inputBox = await input.boundingBox();
      expect(resting.style).toBe("none");
      await page.keyboard.press("Tab");
      await expect(input).toBeFocused();
      expect(await input.evaluate(element => element.matches(":focus-visible"))).toBe(true);
      const focused = await appearance(wrapper);
      expect(focused.style).toBe("solid");
      expect(focused.width).toBe("3px");
      expect(focused.offset).toBe("2px");
      expect(contrast(focused.color, focused.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(focused.color, focused.canvasBackground)).toBeGreaterThanOrEqual(3);
      expect(await wrapper.boundingBox()).toEqual(box);
      expect(await input.boundingBox()).toEqual(inputBox);
      expect(focused.border).toBe(resting.border);
      expect(focused.padding).toBe(resting.padding);
      await page.screenshot({ path: testInfo.outputPath(kind + "-" + surface + "-focus.png") });
      await page.keyboard.press("Tab");
      await expect(after).toBeFocused();
      expect((await appearance(wrapper)).style).toBe("none");
      await page.keyboard.press("Shift+Tab");
      await expect(input).toBeFocused();
      expect((await appearance(wrapper)).style).toBe("solid");
      await testInfo.attach("focus-appearance", { body: JSON.stringify(focused, null, 2), contentType: "application/json" });
    });
  }

  test(`H3 ${kind} search preserves typing, filtering, clearing and pointer focus`, async ({ page }) => {
    await page.goto(`/tests/ui/search-focus-fixture.html?kind=${kind}`);
    const input = page.getByRole("textbox", { name: kind === "personal" ? "Tìm công việc" : "Tìm dự án", exact: true });
    await input.click();
    await expect(input).toBeFocused();
    expect((await appearance(page.getByTestId("search-wrapper"))).style).toBe("solid");
    await input.pressSequentially("Thiết kế");
    await expect(input).toHaveValue("Thiết kế");
    await expect(page.getByRole("list", { name: "Kết quả tìm kiếm" }).getByRole("listitem")).toHaveText(["Thiết kế giao diện"]);
    await input.press("ControlOrMeta+A");
    await input.press("Backspace");
    await expect(input).toHaveValue("");
    await expect(page.getByRole("list", { name: "Kết quả tìm kiếm" }).getByRole("listitem")).toHaveCount(2);
  });

  test(`H3 ${kind} search keeps a visible outline in emulated forced colors`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto(`/tests/ui/search-focus-fixture.html?kind=${kind}`);
    await page.getByRole("button", { name: "Trước tìm kiếm", exact: true }).focus();
    await page.keyboard.press("Tab");
    const focused = await appearance(page.getByTestId("search-wrapper"));
    expect(focused.style).toBe("solid");
    expect(focused.width).toBe("3px");
    expect(contrast(focused.color, focused.background)).toBeGreaterThanOrEqual(3);
  });
}

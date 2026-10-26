const excluded =
  'script,style,noscript,template,svg,math,code,pre,kbd,samp,textarea,input,select,option,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-notranslate],[data-persistent-translate],[data-sensitive],[hidden],[inert],[aria-hidden="true"]';
export function eligible(node: Text, source: string, target: string): boolean {
  const parent = node.parentElement;
  if (!parent || !node.isConnected || parent.closest(excluded)) return false;
  const lang = parent
    .closest('[lang]')
    ?.getAttribute('lang')
    ?.toLowerCase()
    .split('-')[0];
  if (
    lang &&
    (lang === target.toLowerCase().split('-')[0] ||
      lang !== source.toLowerCase().split('-')[0])
  )
    return false;
  for (let el: Element | null = parent; el; el = el.parentElement) {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.contentVisibility === 'hidden'
    )
      return false;
  }
  return true;
}
export function collectText(
  root: Node,
  source: string,
  target: string,
): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const result: Text[] = [];
  let node: Node | null;
  let visited = 0;
  const readable = (value: string) =>
    value.length <= 5000 &&
    /[\p{L}]/u.test(value) &&
    !/^\s*(?:https?:\/\/|www\.)/i.test(value) &&
    !/\{\{|\$\{|%\w+%/.test(value);
  while ((node = walker.nextNode()) && visited++ < 10000) {
    if (!eligible(node as Text, source, target)) continue;
    const value = node.nodeValue ?? '';
    if (!readable(value)) continue;
    result.push(node as Text);
    if (result.length >= 2000) break;
  }
  if (
    root.nodeType === Node.TEXT_NODE &&
    eligible(root as Text, source, target) &&
    readable(root.nodeValue ?? '')
  )
    result.unshift(root as Text);
  return result;
}
export class Patcher {
  private metadata = new WeakMap<Text, { original: string; applied: string }>();
  private nodes = new Set<WeakRef<Text>>();
  source(node: Text): string | null {
    const meta = this.metadata.get(node);
    if (meta && node.nodeValue === meta.applied) return null;
    return node.nodeValue;
  }
  apply(node: Text, expected: string, translated: string): boolean {
    if (
      !node.isConnected ||
      node.nodeValue !== expected ||
      translated.length > 10000
    )
      return false;
    const original =
      this.metadata.get(node)?.applied === expected
        ? this.metadata.get(node)!.original
        : expected;
    if (!this.metadata.has(node)) {
      if (this.nodes.size >= 2000) {
        for (const ref of this.nodes) {
          if (!ref.deref()) this.nodes.delete(ref);
        }
      }
      if (this.nodes.size >= 2000) return false;
      this.nodes.add(new WeakRef(node));
    }
    this.metadata.set(node, { original, applied: translated });
    node.nodeValue = translated;
    return true;
  }
  restore(): void {
    for (const ref of this.nodes) {
      const node = ref.deref();
      if (!node) continue;
      const meta = this.metadata.get(node);
      if (meta && node.nodeValue === meta.applied)
        node.nodeValue = meta.original;
    }
    this.nodes.clear();
    this.metadata = new WeakMap();
  }
}

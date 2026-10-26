import { beforeEach, describe, expect, it } from 'vitest';
import { collectText, Patcher } from '../../src/core/dom/text';

describe('safe text collection and reconciliation', () => {
  it('does not read text values inside protected editable regions', () => {
    document.body.innerHTML =
      '<textarea>private</textarea><div contenteditable>private</div><h1>Hola</h1>';
    for (const parent of document.querySelectorAll(
      'textarea,[contenteditable]',
    )) {
      Object.defineProperty(parent.firstChild!, 'nodeValue', {
        get() {
          throw new Error('private text inspected');
        },
        configurable: true,
      });
    }
    expect(() => collectText(document.body, 'es', 'en')).not.toThrow();
  });
  it('retains revert metadata when a translated node is detached at capacity and reattached', () => {
    const patcher = new Patcher();
    const nodes = Array.from({ length: 2000 }, () =>
      document.createTextNode('Hola'),
    );
    document.body.append(...nodes);
    for (const node of nodes)
      expect(patcher.apply(node, 'Hola', 'Hello')).toBe(true);
    const detached = nodes[0]!;
    detached.remove();
    const extra = document.createTextNode('Más');
    document.body.append(extra);
    patcher.apply(extra, 'Más', 'More');
    document.body.append(detached);
    patcher.restore();
    expect(detached.nodeValue).toBe('Hola');
  });
  it('applies URL and interpolation exclusions to changed Text roots', () => {
    document.body.innerHTML = '<p>Hola</p>';
    const node = document.querySelector('p')!.firstChild as Text;
    node.nodeValue = 'https://private.test/token';
    expect(collectText(node, 'es', 'en')).toEqual([]);
    node.nodeValue = 'Hola {{username}}';
    expect(collectText(node, 'es', 'en')).toEqual([]);
  });
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  it('collects readable phrases and preserves protected descendants and inline languages', () => {
    document.body.innerHTML =
      '<h1>Hola mundo</h1><p hidden>Oculto</p><pre>Código</pre><input value="secreto"><textarea>privado</textarea><p contenteditable>Editar</p><div translate="no"><b>No cambiar</b></div><script>dato</script><p lang="en">Already English</p><p>1234</p><p>https://private.test/key</p><span style="display:none">Invisible</span>';
    expect(
      collectText(document.body, 'es', 'en').map((x) => x.nodeValue),
    ).toEqual(['Hola mundo']);
  });
  it('patches only exact original connected text and restores without overwriting newer app changes', () => {
    document.body.innerHTML = '<p>Hola <a href="/login">Entrar</a></p>';
    const node = document.querySelector('p')!.firstChild as Text;
    const patcher = new Patcher();
    expect(patcher.apply(node, 'Hola ', 'Hello ')).toBe(true);
    expect(document.querySelector('a')!.getAttribute('href')).toBe('/login');
    expect(patcher.source(node)).toBeNull();
    node.nodeValue = 'Nuevo';
    patcher.restore();
    expect(node.nodeValue).toBe('Nuevo');
    expect(patcher.source(node)).toBe('Nuevo');
    node.remove();
    expect(patcher.apply(node, 'Nuevo', 'New')).toBe(false);
  });
  it('treats provider markup as text and reverts only extension output', () => {
    document.body.textContent = 'Hola';
    const node = document.body.firstChild as Text;
    const patcher = new Patcher();
    patcher.apply(node, 'Hola', '<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
    patcher.restore();
    expect(node.nodeValue).toBe('Hola');
  });
});

import { CodeChunk, ChunkType } from '../types';

/**
 * Strips comments and string literals to accurately calculate brace depth without false positives
 */
function getBraceBalance(line: string): { delta: number; openIndex: number } {
  let delta = 0;
  let inString: false | '"' | "'" | '`' = false;
  let isEscaped = false;
  let openIndex = -1;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    // Single line comment
    if (!inString && char === '/' && nextChar === '/') {
      break;
    }

    if (inString) {
      if (char === '\\') {
        isEscaped = !isEscaped;
      } else if (char === inString && !isEscaped) {
        inString = false;
      } else {
        isEscaped = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      isEscaped = false;
      continue;
    }

    if (char === '{') {
      if (openIndex === -1 && delta === 0) {
        openIndex = i;
      }
      delta++;
    } else if (char === '}') {
      delta--;
    }
  }

  return { delta, openIndex };
}

/**
 * Extracts dependencies and hooks from chunk source code
 */
export function extractDependencies(code: string): string[] {
  const deps = new Set<string>();

  const standardHooks = [
    'useState',
    'useEffect',
    'useCallback',
    'useMemo',
    'useRef',
    'useReducer',
    'useContext',
    'useLayoutEffect',
    'useId',
  ];

  for (const hook of standardHooks) {
    if (new RegExp(`\\b${hook}\\b`).test(code)) {
      deps.add(hook);
    }
  }

  // Check for common browser / library APIs
  if (/\blocalStorage\b/.test(code)) deps.add('localStorage');
  if (/\bfetch\b/.test(code)) deps.add('fetch');
  if (/\bnavigator\b/.test(code)) deps.add('navigator');
  if (/\bcanvas\b/i.test(code)) deps.add('HTMLCanvas');
  if (/\bpostMessage\b/.test(code)) deps.add('postMessage');

  // Check for custom component calls like <ChildComponent ...
  const tagMatches = code.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g);
  for (const match of tagMatches) {
    if (match[1] && match[1] !== 'Fragment') {
      deps.add(match[1]);
    }
  }

  return Array.from(deps);
}

/**
 * Determines ChunkType from identifier and signature
 */
function detectChunkType(name: string, firstLine: string): ChunkType {
  if (name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase()) {
    return 'hook';
  }
  if (/reducer/i.test(name) || /\(state,\s*action\)/i.test(firstLine)) {
    return 'reducer';
  }
  if (/^[A-Z]/.test(name)) {
    return 'component';
  }
  if (/^(format|calc|get|set|parse|check|validate|is|has|create|clean|debounce|throttle|sort|filter)/i.test(name)) {
    return 'util';
  }
  return 'other';
}

/**
 * Parses massive single-file monolithic code (even 10,000+ lines)
 * into logical, isolated slices without freezing low-memory mobile UIs.
 */
export function parseMonolithicCode(source: string): CodeChunk[] {
  if (!source || source.trim() === '') {
    return [];
  }

  const lines = source.split('\n');
  const chunks: CodeChunk[] = [];

  // Patterns matching function/component starts at top level
  // Matches:
  // 1. function ComponentName(...) {
  // 2. export default function ComponentName(...) {
  // 3. export function ComponentName(...) {
  // 4. const ComponentName = (...) => {
  // 5. const ComponentName = function(...) {
  // 6. let/var ComponentName = ...
  const funcDeclRegex = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
  const constDeclRegex = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)?\s*(?:=>|function)/;

  let currentChunk: {
    name: string;
    startLine: number;
    firstLine: string;
    braceDepth: number;
    lines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    if (!currentChunk) {
      // Check if this line starts a top-level block
      let name = '';
      const funcMatch = trimmed.match(funcDeclRegex);
      const constMatch = trimmed.match(constDeclRegex);

      if (funcMatch && funcMatch[1]) {
        name = funcMatch[1];
      } else if (constMatch && constMatch[1]) {
        name = constMatch[1];
      }

      if (name) {
        const { delta, openIndex } = getBraceBalance(line);
        if (openIndex !== -1 || delta > 0 || line.includes('{')) {
          currentChunk = {
            name,
            startLine: lineNumber,
            firstLine: line,
            braceDepth: Math.max(1, delta),
            lines: [line],
          };

          // If it opened and closed on the very same line:
          if (delta <= 0 && line.includes('{') && line.includes('}')) {
            const chunkCode = currentChunk.lines.join('\n');
            const type = detectChunkType(name, currentChunk.firstLine);
            const sizeBytes = new Blob([chunkCode]).size;
            chunks.push({
              id: `chunk_${chunks.length + 1}_${name}`,
              name,
              type,
              startLine: currentChunk.startLine,
              endLine: lineNumber,
              code: chunkCode,
              lineCount: 1,
              sizeBytes,
              tokenEstimate: Math.ceil(chunkCode.length / 3.8),
              dependencies: extractDependencies(chunkCode),
            });
            currentChunk = null;
          }
        }
      }
    } else {
      // Accumulate into current block
      currentChunk.lines.push(line);
      const { delta } = getBraceBalance(line);
      currentChunk.braceDepth += delta;

      // When braceDepth reaches 0 or below, the block has concluded
      if (currentChunk.braceDepth <= 0) {
        const chunkCode = currentChunk.lines.join('\n');
        const type = detectChunkType(currentChunk.name, currentChunk.firstLine);
        const sizeBytes = new Blob([chunkCode]).size;

        chunks.push({
          id: `chunk_${chunks.length + 1}_${currentChunk.name}`,
          name: currentChunk.name,
          type,
          startLine: currentChunk.startLine,
          endLine: lineNumber,
          code: chunkCode,
          lineCount: currentChunk.lines.length,
          sizeBytes,
          tokenEstimate: Math.ceil(chunkCode.length / 3.8),
          dependencies: extractDependencies(chunkCode),
        });

        currentChunk = null;
      }
    }
  }

  return chunks;
}

/**
 * Estimates token savings by isolating active chunk instead of sending entire 10k file
 */
export function calculateContextSavings(fullCode: string, chunkCode: string) {
  const fullTokens = Math.ceil(fullCode.length / 3.8);
  const chunkTokens = Math.ceil(chunkCode.length / 3.8);
  const savedTokens = Math.max(0, fullTokens - chunkTokens);
  const percentSaved = fullTokens > 0 ? Number(((savedTokens / fullTokens) * 100).toFixed(1)) : 0;

  return {
    fullTokens,
    chunkTokens,
    savedTokens,
    percentSaved,
  };
}

/**
 * Gist Transpiler:
 * Converts extracted monolithic JSX component into clean, vanilla `React.createElement`
 * JavaScript syntax ready for Secret GitHub Gists and execution via `new Function("React", code)(React)`.
 */
export function transpileJsxToVanilla(jsxCode: string, componentName: string): string {
  try {
    let result = jsxCode;

    // Convert Fragments: <>...</> -> React.createElement(React.Fragment, null, ...)
    result = result.replace(/<>\s*([\s\S]*?)\s*<\/>/g, (_match, inner) => {
      return `React.createElement(React.Fragment, null, ${transpileJsxInner(inner)})`;
    });

    // Transform simple JSX element structures
    result = transpileJsxElements(result);

    // Ensure clean export wrapper suitable for new Function("React", code)(React)
    const exportPattern = new RegExp(`export\\s+default\\s+(?:function\\s+)?${componentName}`);
    if (exportPattern.test(result)) {
      result = result.replace(exportPattern, `function ${componentName}`);
    }

    const header = `/**\n * STARVIX Gist Module: ${componentName}\n * Transpiled to Vanilla React.createElement\n * Execution Sandbox: new Function("React", code)(React)\n */\n`;

    return `${header}${result}\n\nreturn ${componentName};`;
  } catch (error) {
    console.warn('Transpiler warning, fallback to wrapped JSX:', error);
    return `/**\n * STARVIX Gist Module: ${componentName} (Standard Wrapper)\n */\n${jsxCode}\n\nreturn ${componentName};`;
  }
}

/**
 * Internal recursive/regex parser for JSX tags into React.createElement
 */
function transpileJsxElements(code: string): string {
  // Handle self-closing tags: <Tag prop="val" prop={val} />
  let transformed = code.replace(
    /<([A-Za-z0-9_.]+)(\s+[^>/]*)?\s*\/>/g,
    (_match, tagName, rawAttrs) => {
      const parsedTag = /^[a-z]/.test(tagName) ? `"${tagName}"` : tagName;
      const propsObj = parseJsxAttributes(rawAttrs || '');
      return `React.createElement(${parsedTag}, ${propsObj})`;
    }
  );

  // Handle standard opening and closing tags with text or children
  // <Tag prop="val">text or inner</Tag>
  // Simple elements first
  transformed = transformed.replace(
    /<([A-Za-z0-9_.]+)(\s+[^>]*)?>([^<>{}]*)<\/([A-Za-z0-9_.]+)>/g,
    (_match, openTag, rawAttrs, textContent, closeTag) => {
      if (openTag !== closeTag) return _match;
      const parsedTag = /^[a-z]/.test(openTag) ? `"${openTag}"` : openTag;
      const propsObj = parseJsxAttributes(rawAttrs || '');
      const trimmedText = textContent.trim();
      if (!trimmedText) {
        return `React.createElement(${parsedTag}, ${propsObj})`;
      }
      return `React.createElement(${parsedTag}, ${propsObj}, "${trimmedText.replace(/"/g, '\\"')}")`;
    }
  );

  return transformed;
}

function transpileJsxInner(inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed) return 'null';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).trim();
  }
  return transpileJsxElements(trimmed);
}

/**
 * Parses JSX attributes string into a JS object string
 */
function parseJsxAttributes(attrsStr: string): string {
  const trimmed = attrsStr.trim();
  if (!trimmed) return 'null';

  const props: string[] = [];
  const attrRegex = /([A-Za-z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|{([^}]+)}))?/g;
  let match;

  while ((match = attrRegex.exec(trimmed)) !== null) {
    const key = match[1];
    const stringVal1 = match[2];
    const stringVal2 = match[3];
    const exprVal = match[4];

    if (stringVal1 !== undefined) {
      props.push(`"${key}": "${stringVal1}"`);
    } else if (stringVal2 !== undefined) {
      props.push(`"${key}": "${stringVal2}"`);
    } else if (exprVal !== undefined) {
      props.push(`"${key}": ${exprVal.trim()}`);
    } else {
      // boolean true
      props.push(`"${key}": true`);
    }
  }

  if (props.length === 0) return 'null';
  return `{ ${props.join(', ')} }`;
}

/**
 * Replaces monolithic component chunk with lightweight loadGistModule() call
 */
export function replaceChunkWithGistLoader(
  fullCode: string,
  chunk: CodeChunk,
  rawGistUrl: string
): string {
  const lines = fullCode.split('\n');
  const before = lines.slice(0, chunk.startLine - 1);
  const after = lines.slice(chunk.endLine);

  const loaderLine = [
    `// [STARVIX MODULAR REGISTRY] Refactored ${chunk.name} to Secret Gist`,
    `// Original LOC: ${chunk.lineCount} | Size: ${(chunk.sizeBytes / 1024).toFixed(1)} KB`,
    `const ${chunk.name} = loadGistModule("${rawGistUrl}?v=${Date.now()}");`,
  ].join('\n');

  return [...before, loaderLine, ...after].join('\n');
}

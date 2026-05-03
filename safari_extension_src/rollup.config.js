import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const tsPlugin = () =>
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    outDir: undefined,
    declarationDir: undefined,
    sourceMap: false,
  });

const minify = () =>
  terser({
    format: { comments: false },
    compress: { passes: 2, drop_console: false },
    mangle: { keep_classnames: false, keep_fnames: false },
  });

export default [
  {
    input: 'src/content/index.ts',
    output: {
      file: '../ios/SwiftSafariExtension/Resources/content/content_script.js',
      format: 'iife',
      name: 'SwiftGesture',
      sourcemap: false,
    },
    plugins: [resolve(), tsPlugin(), minify()],
  },
  {
    input: 'src/background/index.ts',
    output: {
      file: '../ios/SwiftSafariExtension/Resources/background/background.js',
      format: 'iife',
      name: 'SwiftBackground',
      sourcemap: false,
    },
    plugins: [resolve(), tsPlugin(), minify()],
  },
];

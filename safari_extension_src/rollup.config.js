import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'src/content/index.ts',
    output: {
      file: '../ios/SwiftSafariExtension/Resources/content/content_script.js',
      format: 'iife',
      name: 'SwiftGesture',
      sourcemap: false,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outDir: undefined,
        declarationDir: undefined,
        sourceMap: false,
      }),
    ],
  },
  {
    input: 'src/background/index.ts',
    output: {
      file: '../ios/SwiftSafariExtension/Resources/background/background.js',
      format: 'iife',
      name: 'SwiftBackground',
      sourcemap: false,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outDir: undefined,
        declarationDir: undefined,
        sourceMap: false,
      }),
    ],
  },
];

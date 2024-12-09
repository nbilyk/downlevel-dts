import { pathsToModuleNameMapper, JestConfigWithTsJest } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const jestConfig: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.tsx?$',
    moduleDirectories: ['node_modules', '<rootDir>'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
};

export default jestConfig;

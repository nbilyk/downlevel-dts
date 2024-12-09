import { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testRegex: '(/__tests__/.*|\\.(test|spec))\\.tsx?$',
};

export default jestConfig;

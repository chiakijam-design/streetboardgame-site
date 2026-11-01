import {defineConfig,devices} from '@playwright/test';
const port=4187;
export default defineConfig({testDir:'./tests/e2e',timeout:90000,expect:{timeout:8000},workers:1,retries:0,reporter:'line',
 use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop-chrome',use:{...devices['Desktop Chrome'],channel:'chrome'}},{name:'mobile-chrome',use:{...devices['Pixel 7'],viewport:{width:390,height:667},channel:'chrome'}},{name:'mobile-safari',use:{...devices['iPhone 13'],viewport:{width:390,height:667},browserName:'webkit'}}],
 webServer:{command:'node tools/test-server.mjs',env:{TEST_PORT:String(port)},url:`http://127.0.0.1:${port}/health`,reuseExistingServer:false,timeout:30000},outputDir:'test-results-board'});

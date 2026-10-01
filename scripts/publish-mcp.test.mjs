import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

// Exercise the shell orchestration offline: fake registry, no real publishing.
function run(args, overrides={}) {
  const root=mkdtempSync(join(tmpdir(),'botozap-publish-test-'));
  try {
    for(const path of ['scripts','bin','packages/sdk','packages/mcp/tests/fixtures'])mkdirSync(join(root,path),{recursive:true});
    copyFileSync(new URL('./publish-mcp.sh',import.meta.url),join(root,'scripts/publish-mcp.sh'));
    writeFileSync(join(root,'packages/sdk/package.json'),'{}');
    writeFileSync(join(root,'packages/mcp/package.json'),'{}');
    writeFileSync(join(root,'scripts/packed-tools-only.mjs'),'// fixture check stub');
    writeFileSync(join(root,'packages/mcp/tests/fixtures/release-0.6.0-tools.json'),'{}');
    const stubs={
      git:'if [[ "$1" == branch ]]; then echo "$FAKE_BRANCH"; else printf "%s" "$FAKE_DIRTY"; fi',
      pnpm:'echo "pnpm $*" >> "$TEST_LOG"',
      npm:'echo "npm $*" >> "$TEST_LOG"; if [[ "$1" == publish && "$FAIL_PUBLISH" == 1 ]]; then echo "E409 staged version" >&2; exit 1; fi; if [[ "$1" == view && ! -f "$TEST_LOG.visible" ]]; then touch "$TEST_LOG.visible"; exit 1; fi',
      sleep:'echo "sleep $*" >> "$TEST_LOG"',
      node:'if [[ "$1" == -p ]]; then echo 0.10.0; elif [[ "$1" == ./packed-tools-only.mjs ]]; then test -f ./release-0.6.0-tools.json || exit 9; echo "fixture present" >> "$TEST_LOG"; fi',
    };
    for(const [name,body] of Object.entries(stubs))writeFileSync(join(root,'bin',name),'#!/bin/bash\n'+body+'\n',{mode:0o755});
    writeFileSync(join(root,'log'),'');
    const result=spawnSync('bash',[join(root,'scripts/publish-mcp.sh'),...args],{encoding:'utf8',env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,TEST_LOG:join(root,'log'),FAKE_BRANCH:'main',FAKE_DIRTY:'',FAIL_PUBLISH:'0',...overrides}});
    return {...result,log:readFileSync(join(root,'log'),'utf8')};
  } finally {rmSync(root,{recursive:true,force:true});}
}
test('dry-run accepts a dirty review branch, never polls the registry',()=>{
  const result=run(['--dry-run'],{FAKE_BRANCH:'chore/release-chatgpt-ui',FAKE_DIRTY:' M package.json'});
  assert.equal(result.status,0,result.stderr);assert.match(result.log,/npm publish .*--dry-run/);assert.doesNotMatch(result.log,/npm view|fixture present/);
});
test('real publication requires clean main and rejects unknown arguments',()=>{
  for(const options of [{FAKE_BRANCH:'feature'},{FAKE_DIRTY:' M package.json'}]){const result=run([],options);assert.equal(result.status,1);assert.doesNotMatch(result.log,/npm publish/);}
  assert.equal(run(['--unexpected']).status,1);
});
test('waits for registry propagation and copies the baseline fixture before consumer validation',()=>{
  const result=run([]);assert.equal(result.status,0,result.stderr);assert.equal((result.log.match(/npm publish/g)||[]).length,1);assert.equal((result.log.match(/npm view/g)||[]).length,2);assert.match(result.log,/sleep 15/);assert.match(result.log,/fixture present/);
});
test('E409 aborts without retrying publication or installing the staged version',()=>{
  const result=run([],{FAIL_PUBLISH:'1'});assert.equal(result.status,1);assert.match(result.stderr,/E409/);assert.equal((result.log.match(/npm publish/g)||[]).length,1);assert.doesNotMatch(result.log,/npm view|fixture present/);
});

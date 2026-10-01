"""Offline packaging regressions; no credentials, server calls or portal operations."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

SOURCE = Path(__file__).resolve().parents[1]
REPOSITORY = SOURCE.parents[1]

class PackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name) / 'repo'
        self.root = self.repo / 'plugins/botozap'
        shutil.copytree(SOURCE, self.root)
        fixture = self.repo / 'packages/mcp/tests/fixtures'
        fixture.mkdir(parents=True)
        shutil.copy(REPOSITORY / 'packages/mcp/tests/fixtures/release-0.6.0-tools.json', fixture)
        shutil.copytree(REPOSITORY / 'packages/mcp/src', self.repo / 'packages/mcp/src')
    def tearDown(self):
        self.tmp.cleanup()
    def run_package(self, *args):
        return subprocess.run(['python3', str(self.root/'scripts/package.py'), *map(str,args)], capture_output=True,text=True)
    def manifest(self, mutate):
        path=self.root/'plugin.json';value=json.loads(path.read_text());mutate(value);path.write_text(json.dumps(value))
    def test_reproducible_allowlist_excludes_unrelated_and_secrets(self):
        (self.root/'skills/preparar-template/.env').write_text('PRIVATE=excluded')
        (self.root/'skills/preparar-template/screenshot.png').write_bytes(b'x'*1024)
        (self.root/'reviewer_instructions.txt').write_text('private excluded')
        first=Path(self.tmp.name)/'one.zip';second=Path(self.tmp.name)/'two.zip'
        self.assertEqual(self.run_package('--zip',first).returncode,0)
        self.assertEqual(self.run_package('--zip',second).returncode,0)
        self.assertEqual(hashlib.sha256(first.read_bytes()).digest(),hashlib.sha256(second.read_bytes()).digest())
        with zipfile.ZipFile(first) as z:
            self.assertEqual(len(z.namelist()),9)
            self.assertTrue(all(n in ['plugin.json','mcp.json','assets/icon.png'] or n.endswith('/SKILL.md') for n in z.namelist()))
    def test_private_review_metadata_rejected(self):
        self.manifest(lambda m:m['extensions']['com.openai']['review'].update(test_credentials='not-a-real-secret'))
        self.assertNotEqual(self.run_package().returncode,0)
    def test_secret_in_allowed_skill_rejected(self):
        with (self.root/'skills/preparar-template/SKILL.md').open('a') as f:f.write('\nbz_live_not_a_real_secret\n')
        self.assertNotEqual(self.run_package().returncode,0)
    def test_unknown_tool_rejected(self):
        self.manifest(lambda m:m['extensions']['com.openai']['review']['test_cases']['positive'][0].update(tools_triggered='nonexistent_tool'))
        self.assertNotEqual(self.run_package().returncode,0)
    def test_symlink_and_private_app_binding_rejected(self):
        p=self.root/'skills/preparar-template/SKILL.md';data=p.read_text();p.unlink();target=Path(self.tmp.name)/'outside.md';target.write_text(data);p.symlink_to(target)
        self.assertNotEqual(self.run_package().returncode,0)
        p.unlink();p.write_text(data);(self.root/'.app.json').write_text('{}')
        self.assertNotEqual(self.run_package().returncode,0)
    def test_missing_integrated_ui_tool_rejected(self):
        for p in (self.repo/'packages/mcp/src').rglob('*.ts'):
            text=p.read_text()
            if 'open_botozap' in text:
                p.write_text(text.replace('open_botozap', 'removed_global_tool'))
        self.assertNotEqual(self.run_package().returncode,0)
    def test_pilot_routing_in_every_skill(self):
        for p in (self.root/'skills').glob('*/SKILL.md'):
            text=p.read_text()
            self.assertIn('Pedido completo e explícito',text)
            self.assertIn('permissão do ChatGPT',text)
            self.assertIn('Pedido vago/incompleto',text)
            self.assertIn('`create_template`',text)
    def test_listing_limits_and_submission_gate(self):
        self.assertNotEqual(self.run_package('--submission-ready').returncode,0)
        self.manifest(lambda m:m['extensions']['com.openai']['interface'].update(shortDescription='x'*31))
        self.assertNotEqual(self.run_package().returncode,0)

    def test_real_reviewer_cases_fit_fixture_without_appointments_or_contact_phone(self):
        manifest=json.loads((self.root/'plugin.json').read_text())
        cases=manifest['extensions']['com.openai']['review']['test_cases']
        positive=json.dumps(cases['positive'],ensure_ascii=False)
        self.assertEqual(len(cases['positive']),5)
        self.assertEqual(len(cases['negative']),3)
        self.assertNotIn('appointment',positive.lower())
        self.assertIn('Fernando Gomes',positive)
        self.assertIn('confirmacao_pedido',positive)
        self.assertIn('acknowledged',positive)
        self.assertNotIn('reviewer@botozap.com.br',json.dumps(manifest))
        self.assertNotRegex(positive,r'\+55\s*\d{2}')

if __name__=='__main__' :unittest.main()

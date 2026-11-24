/* Sets the icon and the version information of the Windows executable without Wine (resedit is pure JavaScript), because
   electron-builder's own resource editing (rcedit) needs Wine on Linux. */
'use strict';
const fs = require('fs'), path = require('path');
exports.default = async ctx => {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default || ResEdit;
  const pkg = require('../package.json'), exe = path.join(ctx.appOutDir, pkg.build.win.executableName + '.exe');
  const bin = NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true }), res = NtExecutableResource.from(bin);
  const ico = Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map(i => i.data));
  const vi = Resource.VersionInfo.fromEntries(res.entries)[0] || Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: 'ENDLESS RAILS', ProductName: 'ENDLESS RAILS', CompanyName: 'Endless Rails', LegalCopyright: pkg.build.copyright, OriginalFilename: pkg.build.win.executableName + '.exe', InternalName: 'endless-rails', FileVersion: pkg.version, ProductVersion: pkg.version });
  vi.outputToResourceEntries(res.entries); res.outputResource(bin);
  fs.writeFileSync(exe, Buffer.from(bin.generate()));
  console.log('  • icon and version info set on', path.basename(exe));
};

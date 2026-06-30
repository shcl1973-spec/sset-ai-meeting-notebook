const fs = require("fs");
const path = require("path");

const manifestPath = path.resolve(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
const permission = '<uses-permission android:name="android.permission.RECORD_AUDIO" />';

if (!manifest.includes(permission)) {
  manifest = manifest.replace(/(<manifest\b[^>]*>)/, `$1\n    ${permission}`);
  fs.writeFileSync(manifestPath, manifest);
  console.log("Added RECORD_AUDIO permission to AndroidManifest.xml");
} else {
  console.log("RECORD_AUDIO permission already present");
}

// Public assets live at the site root, independent of the UI locale.
export function rootPublicResource(value) {
  return String(value).replace(/^(?:\.\/)?(assets\/|dist\/)/, '/$1');
}

export function rootPublicSourceSet(value) {
  return String(value).split(',').map((part) => part.replace(/^(\s*)((?:\.\/)?(?:assets|dist)\/\S+)/, (_, space, resource) => space + rootPublicResource(resource))).join(',');
}

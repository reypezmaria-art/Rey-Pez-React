export function download(name, content, mime = "text/csv;charset=utf-8") {
  const isCSV = mime.startsWith("text/csv");
  const url = URL.createObjectURL(
    new Blob([isCSV ? "\uFEFF" : "", content], { type: mime }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

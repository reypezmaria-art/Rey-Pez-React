export function deviceId() {
  let id = localStorage.getItem("reypez_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("reypez_device_id", id);
  }
  return id;
}

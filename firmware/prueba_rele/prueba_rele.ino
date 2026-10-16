// Prueba mínima del relé en el GPIO 22. Mismo contrato que el firmware completo.
//   Botón "Llenar" de la app → 30 s · Admin "Probar relé" → 3 s.
//   Uno a la vez: mientras el relé está prendido, otra orden recibe 409 "ocupado".
//   Idempotente: si llega la misma orden (mismo id) otra vez, no vuelve a llenar.
//
// Conexión del módulo relé:  IN → GPIO 22 · VCC → 5V (VIN) · GND → GND
// Red Wi-Fi: "SmartDose" / cambiar123  →  la app apunta a 192.168.4.1

#include <WiFi.h>
#include <WebServer.h>

const int PIN_RELE = 22;
const bool RELE_ACTIVO_BAJO = false;         // tu módulo se activa con HIGH: apagado = LOW. Si queda prendido solo, pon true
const long PULSO_SEG = 3;              // si la app no dice cuánto
const long MAX_SEG = 120;

WebServer server(80);
unsigned long apagarEn = 0;           // 0 = apagado
String trabajoId = "";                // id del último llenado aceptado

void rele(bool prendido) {
  digitalWrite(PIN_RELE, prendido == RELE_ACTIVO_BAJO ? LOW : HIGH);
  if (!prendido) apagarEn = 0;
}

long restaMs() { return apagarEn ? max(0L, (long)(apagarEn - millis())) : 0; }

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

// Lee un campo simple de un JSON plano: {"segundos":30,"id":"abc"}
String campo(const String& json, const char* nombre) {
  int i = json.indexOf(String("\"") + nombre + "\"");
  if (i < 0) return "";
  int j = json.indexOf(':', i) + 1;
  while (json[j] == ' ' || json[j] == '"') j++;
  int k = j;
  while (k < (int)json.length() && json[k] != ',' && json[k] != '}' && json[k] != '"') k++;
  return json.substring(j, k);
}

void handlePing() {
  cors();
  String out = String("{\"ok\":true,\"version\":\"prueba\",\"uptime_s\":") + millis() / 1000 +
               ",\"clientes\":" + WiFi.softAPgetStationNum() +
               ",\"memoria_libre\":" + ESP.getFreeHeap() +
               ",\"rele\":" + (apagarEn ? "true" : "false") +
               ",\"rele_pin\":" + PIN_RELE +
               ",\"estado\":\"" + (apagarEn ? "ocupado" : "libre") + "\"}";
  server.send(200, "application/json", out);
}

void handleEstado() {
  cors();
  String out = String("{\"estado\":\"libre\",\"rele_ms\":") + restaMs() +
               ",\"trabajo_id\":\"" + trabajoId + "\"}";
  server.send(200, "application/json", out);
}

void handleRele() {
  cors();
  // Equivale a: digitalWrite ON → delay(N s) → digitalWrite OFF,
  // pero sin delay(): el ESP32 sigue respondiendo a la app mientras tanto.
  String cuerpo = server.arg("plain");
  String s = campo(cuerpo, "segundos");
  long seg = s.length() ? s.toInt() : PULSO_SEG;
  String id = campo(cuerpo, "id");
  if (seg < 0 || seg > MAX_SEG) { server.send(400, "application/json", "{\"error\":\"fuera de rango\"}"); return; }

  if (seg == 0) {                      // apagar siempre se permite
    rele(false);
    Serial.println("Relé OFF");
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }
  if (id.length() && id == trabajoId) {
    server.send(200, "application/json", String("{\"ok\":true,\"repetido\":true,\"rele_ms\":") + restaMs() + "}");
    return;
  }
  if (apagarEn) {
    server.send(409, "application/json", String("{\"error\":\"ocupado\",\"rele_ms\":") + restaMs() + "}");
    return;
  }
  trabajoId = id;
  rele(true);
  apagarEn = millis() + seg * 1000UL;
  if (apagarEn == 0) apagarEn = 1;
  Serial.print("Relé ON por "); Serial.print(seg); Serial.println(" s");
  server.send(200, "application/json", String("{\"ok\":true,\"rele_ms\":") + restaMs() + "}");
}

void setup() {
  Serial.begin(115200);
  rele(false);                        // antes de pinMode: no hace clic al arrancar
  pinMode(PIN_RELE, OUTPUT);

  WiFi.softAP("SmartDose", "cambiar123", 1, 0, 8);
  WiFi.setSleep(false);
  Serial.print("Listo en "); Serial.println(WiFi.softAPIP());

  server.on("/ping", HTTP_GET, handlePing);
  server.on("/estado", HTTP_GET, handleEstado);
  server.on("/rele", HTTP_POST, handleRele);
  server.onNotFound([]() { cors(); server.send(server.method() == HTTP_OPTIONS ? 204 : 404); });
  server.begin();
}

void loop() {
  server.handleClient();
  if (apagarEn && (long)(millis() - apagarEn) >= 0) {
    rele(false);
    Serial.println("Relé OFF");
  }
}

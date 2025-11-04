from typing import Tuple, List
from smartcard.System import readers
from smartcard.CardType import AnyCardType
from smartcard.CardRequest import CardRequest
from smartcard.Exceptions import NoCardException
from smartcard.scard import SCARD_PROTOCOL_T0, SCARD_PROTOCOL_T1, SCARD_SHARE_SHARED
import subprocess
import re
from data_APDU import SELECT, THAI_ID_CARD, APDU_DATA, GENDER, RELIGION


class IDCardReader:
    def __init__(self) -> None:
        self.cardservice = None

    def _log(self, msg: str) -> None:
        print(msg)

    def disconnect_card(self) -> None:
        if not self.cardservice:
            return
        try:
            conn = getattr(self.cardservice, "connection", None)
            if conn:
                conn.disconnect()
        except Exception as e:
            self._log(f"[ผิดพลาด] ไม่สามารถตัดการเชื่อมต่อ: {e}")
        finally:
            self.cardservice = None

    def connect_card(self, timeout: int = 5) -> bool:
        try:
            cardtype = AnyCardType()
            cardrequest = CardRequest(timeout=timeout, cardType=cardtype)
            self.cardservice = cardrequest.waitforcard()
            self.cardservice.connection.connect(
                protocol=SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
                mode=SCARD_SHARE_SHARED,
            )
            # ATR available if needed:
            _ = self.cardservice.connection.getATR()
            return True
        except Exception as e:
            self._log(f"[ผิดพลาด] ไม่สามารถเชื่อมต่อบัตร: {e}")
            self.disconnect_card()
            return False

    def check_reader_status(self) -> bool:
        try:
            result = subprocess.run(
                ["sc", "query", "SCardSvr"], capture_output=True, text=True, shell=False
            )
            if not result.stdout or "RUNNING" not in result.stdout:
                return False
            return bool(readers())
        except Exception:
            return False

    @staticmethod
    def decode_text(data: List[int]) -> str:
        try:
            return bytes(data).decode("tis-620", errors="ignore").strip()
        except Exception:
            return "".join(chr(b) if b < 128 else "?" for b in data).strip()

    @staticmethod
    def convert_date(txt: str) -> str:
        if len(txt) == 8:
            y, m, d = txt[:4], txt[4:6], txt[6:8]
            return f"{d}/{m}/{y}"
        return txt

    def send_apdu_with_get_response(
        self, connection, apdu: List[int]
    ) -> Tuple[List[int], int, int]:
        response, sw1, sw2 = connection.transmit(apdu)
        if sw1 == 0x61:
            get_response = [0x00, 0xC0, 0x00, 0x00, sw2]
            response, sw1, sw2 = connection.transmit(get_response)
        return response, sw1, sw2

    def _read_field(self, connection, apdu: List[int], desc: str, key: str ,id: str) -> None:
        response, sw1, sw2 = self.send_apdu_with_get_response(connection, apdu)
        if not (sw1 == 0x90 and sw2 == 0x00):
            self._log(f"[ผิดพลาด] ไม่สามารถอ่านข้อมูล {desc} ได้ (SW: {sw1:02x} {sw2:02x})")
            return

        data = {
            id: None
        }

        decoded = self.decode_text(response)
        if key in ("APDU_BIRTH", "APDU_ISSUE", "APDU_EXPIRE"):
            formatted = self.convert_date(decoded)
            data[id] = formatted
        elif key == "APDU_GENDER":
            try:
                formatted = GENDER[int(decoded)]
            except Exception:
                formatted = decoded
            data[id] = formatted
        elif key == "APDU_RELIGION":
            try:
                formatted = RELIGION[int(decoded)]
            except Exception:
                formatted = decoded
            data[id] = formatted
        else:
            formatted = re.sub(r"#+", " ", decoded)
            data[id] = formatted

        self._log(data)

    def read_id_card(self) -> bool:
        try:
            self.disconnect_card()
            if not self.connect_card():
                return False

            conn = self.cardservice.connection
            _response, sw1, sw2 = conn.transmit(SELECT + THAI_ID_CARD)
            if sw1 == 0x61:
                _response, sw1, sw2 = conn.transmit([0x00, 0xC0, 0x00, 0x00, sw2])

            if sw1 != 0x90:
                self._log(f"[ผิดพลาด] ไม่สามารถเลือก Applet ได้ SW: {sw1:02x} {sw2:02x}")
                self.disconnect_card()
                return False

            self._log(f"[สำเร็จ] เลือก Thai ID Applet สำเร็จ (SW: {sw1:02x} {sw2:02x})")

            for item in APDU_DATA:
                self._read_field(conn, item["apdu"], item["desc"], item["key"] , item["id"])

            self._log("\n[สำเร็จ] อ่านบัตรประชาชนสำเร็จ")
            self.disconnect_card()
            return True

        except NoCardException:
            self._log("\n[ผิดพลาด] ไม่พบบัตรประชาชน กรุณาใส่บัตรแล้วลองใหม่")
            self.disconnect_card()
            return False
        except Exception as e:
            self._log(f"\n[ผิดพลาด] เกิดข้อผิดพลาดในการอ่านบัตร: {e}")
            self.disconnect_card()
            return False

    def run(self) -> None:
        if not self.check_reader_status():
            self._log("[ผิดพลาด] บริการ SCardSvr ไม่ทำงานหรือไม่มี reader")
            return
        try:
            self.read_id_card()
        except Exception as e:
            self._log(f"\n[ผิดพลาด] เกิดข้อผิดพลาด: {e}")


if __name__ == "__main__":
    reader = IDCardReader()
    reader.run()

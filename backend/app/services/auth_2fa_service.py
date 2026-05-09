import pyotp
import qrcode
import io
import base64
from app.models.user import User

def generate_totp_secret() -> str:
    """Генерирует новый секретный ключ для TOTP."""
    return pyotp.random_base32()

def get_totp_uri(user: User, secret: str) -> str:
    """Генерирует URI для QR-кода."""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.email,
        issuer_name="OvertimeSystem"
    )

def generate_qr_base64(uri: str) -> str:
    """Генерирует QR-код в формате base64."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()

def verify_totp_code(secret: str, code: str) -> bool:
    """Проверяет введенный одноразовый код."""
    totp = pyotp.totp.TOTP(secret)
    return totp.verify(code)

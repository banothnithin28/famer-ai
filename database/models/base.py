from sqlalchemy import BigInteger, DOUBLE_PRECISION, Integer, REAL
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


INTEGER_64 = BigInteger().with_variant(Integer(), "sqlite")
FLOAT_64 = DOUBLE_PRECISION().with_variant(REAL(), "sqlite")

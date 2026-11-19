/**
 * Pure ES Module Minecraft Binary NBT Encoder & Decoder + Gzip
 * Zero external dependencies — works identically in Browser & Node.js 18+
 */

export const TAG = {
  END: 0,
  BYTE: 1,
  SHORT: 2,
  INT: 3,
  LONG: 4,
  FLOAT: 5,
  DOUBLE: 6,
  BYTE_ARRAY: 7,
  STRING: 8,
  LIST: 9,
  COMPOUND: 10,
  INT_ARRAY: 11,
  LONG_ARRAY: 12,
};

// Typed constructors for unambiguous NBT serialization
export const nbt = {
  byte: (value) => ({ type: TAG.BYTE, value: Number(value) | 0 }),
  short: (value) => ({ type: TAG.SHORT, value: Number(value) | 0 }),
  int: (value) => ({ type: TAG.INT, value: Number(value) | 0 }),
  long: (value) => ({ type: TAG.LONG, value: BigInt(value) }),
  float: (value) => ({ type: TAG.FLOAT, value: Number(value) }),
  double: (value) => ({ type: TAG.DOUBLE, value: Number(value) }),
  byteArray: (value) => ({
    type: TAG.BYTE_ARRAY,
    value: value instanceof Int8Array ? value : Int8Array.from(value),
  }),
  string: (value) => ({ type: TAG.STRING, value: String(value) }),
  list: (elemType, value = []) => ({ type: TAG.LIST, elemType, value }),
  compound: (value = {}) => ({ type: TAG.COMPOUND, value }),
  intArray: (value) => ({ type: TAG.INT_ARRAY, value: Int32Array.from(value) }),
  longArray: (value) => ({
    type: TAG.LONG_ARRAY,
    value: value instanceof BigInt64Array || value instanceof BigUint64Array
      ? value
      : BigInt64Array.from(value, (v) => BigInt(v)),
  }),
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

class GrowableBuffer {
  constructor(initialCapacity = 65536) {
    this.buf = new ArrayBuffer(initialCapacity);
    this.u8 = new Uint8Array(this.buf);
    this.view = new DataView(this.buf);
    this.offset = 0;
  }

  ensure(extraBytes) {
    const needed = this.offset + extraBytes;
    if (needed <= this.buf.byteLength) return;
    let nextCap = this.buf.byteLength * 2;
    while (nextCap < needed) nextCap *= 2;
    const nextBuf = new ArrayBuffer(nextCap);
    const nextU8 = new Uint8Array(nextBuf);
    nextU8.set(this.u8.subarray(0, this.offset));
    this.buf = nextBuf;
    this.u8 = nextU8;
    this.view = new DataView(this.buf);
  }

  writeByte(v) {
    this.ensure(1);
    this.view.setInt8(this.offset, v);
    this.offset += 1;
  }

  writeUByte(v) {
    this.ensure(1);
    this.view.setUint8(this.offset, v);
    this.offset += 1;
  }

  writeShort(v) {
    this.ensure(2);
    this.view.setInt16(this.offset, v, false);
    this.offset += 2;
  }

  writeUShort(v) {
    this.ensure(2);
    this.view.setUint16(this.offset, v, false);
    this.offset += 2;
  }

  writeInt(v) {
    this.ensure(4);
    this.view.setInt32(this.offset, v, false);
    this.offset += 4;
  }

  writeLong(v) {
    this.ensure(8);
    this.view.setBigInt64(this.offset, BigInt.asIntN(64, BigInt(v)), false);
    this.offset += 8;
  }

  writeULong(v) {
    this.ensure(8);
    this.view.setBigUint64(this.offset, BigInt.asUintN(64, BigInt(v)), false);
    this.offset += 8;
  }

  writeFloat(v) {
    this.ensure(4);
    this.view.setFloat32(this.offset, v, false);
    this.offset += 4;
  }

  writeDouble(v) {
    this.ensure(8);
    this.view.setFloat64(this.offset, v, false);
    this.offset += 8;
  }

  writeString(str) {
    const bytes = textEncoder.encode(str);
    if (bytes.length > 65535) {
      throw new Error(`NBT string exceeds 65535 bytes: ${str.slice(0, 40)}...`);
    }
    this.writeUShort(bytes.length);
    this.ensure(bytes.length);
    this.u8.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  toUint8Array() {
    return this.u8.slice(0, this.offset);
  }
}

function writePayload(out, tag) {
  switch (tag.type) {
    case TAG.BYTE:
      out.writeByte(tag.value);
      break;
    case TAG.SHORT:
      out.writeShort(tag.value);
      break;
    case TAG.INT:
      out.writeInt(tag.value);
      break;
    case TAG.LONG:
      out.writeLong(tag.value);
      break;
    case TAG.FLOAT:
      out.writeFloat(tag.value);
      break;
    case TAG.DOUBLE:
      out.writeDouble(tag.value);
      break;
    case TAG.BYTE_ARRAY: {
      const arr = tag.value;
      out.writeInt(arr.length);
      out.ensure(arr.length);
      out.u8.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), out.offset);
      out.offset += arr.length;
      break;
    }
    case TAG.STRING:
      out.writeString(tag.value);
      break;
    case TAG.LIST: {
      const items = tag.value || [];
      const elemType = items.length === 0 ? TAG.END : tag.elemType;
      out.writeUByte(elemType);
      out.writeInt(items.length);
      for (let i = 0; i < items.length; i++) {
        writePayload(out, items[i]);
      }
      break;
    }
    case TAG.COMPOUND: {
      const entries = Object.entries(tag.value || {});
      for (const [key, child] of entries) {
        if (!child) continue;
        out.writeUByte(child.type);
        out.writeString(key);
        writePayload(out, child);
      }
      out.writeUByte(TAG.END);
      break;
    }
    case TAG.INT_ARRAY: {
      const arr = tag.value;
      out.writeInt(arr.length);
      for (let i = 0; i < arr.length; i++) {
        out.writeInt(arr[i]);
      }
      break;
    }
    case TAG.LONG_ARRAY: {
      const arr = tag.value;
      out.writeInt(arr.length);
      const isUnsigned = arr instanceof BigUint64Array;
      for (let i = 0; i < arr.length; i++) {
        if (isUnsigned) out.writeULong(arr[i]);
        else out.writeLong(arr[i]);
      }
      break;
    }
    default:
      throw new Error(`Unsupported NBT tag type: ${tag.type}`);
  }
}

/**
 * Serialize a root compound NBT tag into uncompressed Uint8Array.
 */
export function encodeNbt(rootCompound, rootName = '') {
  const out = new GrowableBuffer(65536);
  out.writeUByte(TAG.COMPOUND);
  out.writeString(rootName);
  writePayload(out, rootCompound);
  return out.toUint8Array();
}

/**
 * Parse uncompressed NBT Uint8Array back into typed NBT tree.
 */
export function decodeNbt(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let offset = 0;

  function readUByte() {
    const v = view.getUint8(offset);
    offset += 1;
    return v;
  }
  function readByte() {
    const v = view.getInt8(offset);
    offset += 1;
    return v;
  }
  function readShort() {
    const v = view.getInt16(offset, false);
    offset += 2;
    return v;
  }
  function readUShort() {
    const v = view.getUint16(offset, false);
    offset += 2;
    return v;
  }
  function readInt() {
    const v = view.getInt32(offset, false);
    offset += 4;
    return v;
  }
  function readLong() {
    const v = view.getBigInt64(offset, false);
    offset += 8;
    return v;
  }
  function readFloat() {
    const v = view.getFloat32(offset, false);
    offset += 4;
    return v;
  }
  function readDouble() {
    const v = view.getFloat64(offset, false);
    offset += 8;
    return v;
  }
  function readString() {
    const len = readUShort();
    const str = textDecoder.decode(u8.subarray(offset, offset + len));
    offset += len;
    return str;
  }

  function readPayload(type) {
    switch (type) {
      case TAG.BYTE:
        return nbt.byte(readByte());
      case TAG.SHORT:
        return nbt.short(readShort());
      case TAG.INT:
        return nbt.int(readInt());
      case TAG.LONG:
        return nbt.long(readLong());
      case TAG.FLOAT:
        return nbt.float(readFloat());
      case TAG.DOUBLE:
        return nbt.double(readDouble());
      case TAG.BYTE_ARRAY: {
        const len = readInt();
        const slice = new Int8Array(u8.buffer.slice(u8.byteOffset + offset, u8.byteOffset + offset + len));
        offset += len;
        return { type: TAG.BYTE_ARRAY, value: slice };
      }
      case TAG.STRING:
        return nbt.string(readString());
      case TAG.LIST: {
        const elemType = readUByte();
        const len = readInt();
        const items = new Array(len);
        for (let i = 0; i < len; i++) {
          items[i] = readPayload(elemType);
        }
        return nbt.list(elemType, items);
      }
      case TAG.COMPOUND: {
        const map = {};
        while (true) {
          const childType = readUByte();
          if (childType === TAG.END) break;
          const key = readString();
          map[key] = readPayload(childType);
        }
        return nbt.compound(map);
      }
      case TAG.INT_ARRAY: {
        const len = readInt();
        const arr = new Int32Array(len);
        for (let i = 0; i < len; i++) arr[i] = readInt();
        return { type: TAG.INT_ARRAY, value: arr };
      }
      case TAG.LONG_ARRAY: {
        const len = readInt();
        const arr = new BigUint64Array(len);
        for (let i = 0; i < len; i++) {
          arr[i] = view.getBigUint64(offset, false);
          offset += 8;
        }
        return { type: TAG.LONG_ARRAY, value: arr };
      }
      default:
        throw new Error(`Unknown NBT tag type ${type} at offset ${offset}`);
    }
  }

  const rootType = readUByte();
  if (rootType !== TAG.COMPOUND) {
    throw new Error(`Expected root TAG_COMPOUND (10), got ${rootType}`);
  }
  const rootName = readString();
  const root = readPayload(TAG.COMPOUND);
  return { rootName, root };
}

async function pipeThroughStream(bytes, transformStream) {
  const blob = new Blob([bytes]);
  const stream = blob.stream().pipeThrough(transformStream);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Gzip compress Uint8Array (uses native CompressionStream in Browser & Node 18+).
 */
export async function gzipCompress(bytes) {
  return pipeThroughStream(bytes, new CompressionStream('gzip'));
}

/**
 * Gzip decompress Uint8Array if gzipped (magic 0x1f 0x8b), otherwise return as-is.
 */
export async function gzipDecompress(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
    return pipeThroughStream(u8, new DecompressionStream('gzip'));
  }
  return u8;
}

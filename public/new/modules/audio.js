export function createWavBlob(int16Data, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = int16Data.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let index = 0; index < str.length; index += 1) {
      view.setUint8(offset + index, str.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < int16Data.length; index += 1) {
    view.setInt16(offset, int16Data[index], true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

export function applyGainToSamples(baseSamples, gain, clampEncodeGain) {
  if (!baseSamples) {
    return null;
  }
  const multiplier = clampEncodeGain(gain);
  const output = new Int16Array(baseSamples.length);
  for (let index = 0; index < baseSamples.length; index += 1) {
    let sample = baseSamples[index] * multiplier;
    if (sample > 32767) sample = 32767;
    else if (sample < -32768) sample = -32768;
    output[index] = Math.round(sample);
  }
  return output;
}

export function stopHistoryLoopPlayback(scannerState, rerender, renderEncodeHistoryFn) {
  if (scannerState.historyLoopAudio) {
    scannerState.historyLoopAudio.pause();
    scannerState.historyLoopAudio.currentTime = 0;
    scannerState.historyLoopAudio.src = "";
    scannerState.historyLoopAudio = null;
  }
  if (scannerState.historyLoopObjectUrl) {
    URL.revokeObjectURL(scannerState.historyLoopObjectUrl);
    scannerState.historyLoopObjectUrl = null;
  }
  scannerState.historyLoopEntryId = null;
  if (rerender) {
    renderEncodeHistoryFn();
  }
}

export function encodePayloadToWavBlob({
  scannerState,
  payload,
  protocolId,
  clampEncodeGain,
}) {
  const waveform = scannerState.ggwave.encode(scannerState.ggwaveInstance, payload, protocolId, 10);
  if (!waveform || !waveform.length) {
    throw new Error("Empty waveform from ggwave");
  }
  const waveformCopy = new Int8Array(waveform);
  const int16Samples = new Int16Array(waveformCopy.buffer.slice(0));
  const scaledSamples = applyGainToSamples(int16Samples, scannerState.encodeGain, clampEncodeGain) || int16Samples;
  return createWavBlob(scaledSamples, scannerState.sampleRate);
}

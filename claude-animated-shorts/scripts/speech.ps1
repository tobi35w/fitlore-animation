param(
    [string]$TextPath,
    [string]$OutputWav,
    [string]$WordsPath,
    [string]$Voice = 'Microsoft David Desktop',
    [ValidateRange(-10, 10)][int]$Rate = 0,
    [switch]$ListVoices
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
if ($ListVoices) {
    $animationSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $availableVoices = @($animationSynth.GetInstalledVoices() | ForEach-Object {
            [pscustomobject]@{name=$_.VoiceInfo.Name; culture=$_.VoiceInfo.Culture.Name; enabled=$_.Enabled}
        })
        ConvertTo-Json -InputObject $availableVoices
    } finally { $animationSynth.Dispose() }
    exit 0
}
if (-not $TextPath -or -not $OutputWav -or -not $WordsPath) { throw 'TextPath, OutputWav and WordsPath are required.' }
$speechSource = @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class AnimationWord {
    public string w { get; set; }
    public double s { get; set; }
    public double e { get; set; }
}
public class AnimationSpeechResult {
    public List<AnimationWord> Words = new List<AnimationWord>();
    public double Duration;
    public string Voice;
}
public static class AnimationSpeech {
    public static AnimationSpeechResult Generate(string text, string file, string voice, int rate) {
        var result = new AnimationSpeechResult();
        using (var synth = new SpeechSynthesizer()) {
            synth.SelectVoice(voice);
            synth.Rate = rate;
            synth.Volume = 100;
            result.Voice = synth.Voice.Name;
            synth.SetOutputToWaveFile(file, new SpeechAudioFormatInfo(48000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            synth.SpeakProgress += delegate(object sender, SpeakProgressEventArgs args) {
                if (!String.IsNullOrWhiteSpace(args.Text)) {
                    result.Words.Add(new AnimationWord { w = args.Text, s = args.AudioPosition.TotalSeconds });
                }
            };
            synth.Speak(text);
            synth.SetOutputToNull();
        }
        using (var stream = File.OpenRead(file))
        using (var reader = new BinaryReader(stream)) {
            stream.Position = 12;
            while (stream.Position + 8 <= stream.Length) {
                var id = new String(reader.ReadChars(4));
                uint size = reader.ReadUInt32();
                if (id == "data") { result.Duration = size / 96000.0; break; }
                stream.Position += size + (size % 2);
            }
        }
        for (int i = 0; i < result.Words.Count; i++) {
            result.Words[i].e = i + 1 < result.Words.Count ? result.Words[i + 1].s : result.Duration;
        }
        return result;
    }
}
'@
Add-Type -TypeDefinition $speechSource -ReferencedAssemblies 'System.Speech'
$narrationText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $TextPath).Path)
if ([string]::IsNullOrWhiteSpace($narrationText)) { throw 'The narration text is empty.' }
$wavParent = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($OutputWav))
$wordsParent = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($WordsPath))
[System.IO.Directory]::CreateDirectory($wavParent) | Out-Null
[System.IO.Directory]::CreateDirectory($wordsParent) | Out-Null
$speechResult = [AnimationSpeech]::Generate($narrationText, [System.IO.Path]::GetFullPath($OutputWav), $Voice, $Rate)
if ($speechResult.Words.Count -eq 0 -or $speechResult.Duration -le 0) { throw 'The speech engine returned no audio or word timings.' }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$wordJson = ConvertTo-Json -InputObject @($speechResult.Words) -Depth 4
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($WordsPath), $wordJson + [Environment]::NewLine, $utf8NoBom)
$speechMetadata = [pscustomobject]@{
    engine='Windows System.Speech'; voice=$speechResult.Voice; rate=$Rate;
    durationSeconds=$speechResult.Duration; sampleRate=48000; words=$speechResult.Words.Count;
    timingNote='Starts are speech-engine word boundaries. Each end is the next word start; inspect long pauses when planning shots.'
}
$metadataPath = Join-Path $wordsParent 'voice-info.json'
[System.IO.File]::WriteAllText($metadataPath, (ConvertTo-Json $speechMetadata) + [Environment]::NewLine, $utf8NoBom)
$speechMetadata | ConvertTo-Json

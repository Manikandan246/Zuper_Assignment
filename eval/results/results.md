# STT Eval Results
Run: 2026-05-03T15:39:42.104Z

## Per-clip results

| Clip | Category | Provider | WER | Domain term recall | Latency (ms) | Cost (USD) |
|---|---|---|---:|---:|---:|---:|
| clip01_clean_baseline | baseline | deepgram/nova-3 | 6.1% | 8/11 (73%) | 3699 | $0.0022 |
| clip01_clean_baseline | baseline | openai/whisper-1 | 12.1% | 9/11 (82%) | 5055 | $0.0031 |
| clip02_clean_terminology_dense | domain_vocab | deepgram/nova-3 | 9.2% | 11/12 (92%) | 3506 | $0.0020 |
| clip02_clean_terminology_dense | domain_vocab | openai/whisper-1 | 10.8% | 11/12 (92%) | 5240 | $0.0028 |
| clip03_outdoor_with_traffic | field_noise | deepgram/nova-3 | 1.8% | 5/5 (100%) | 10591 | $0.0017 |
| clip03_outdoor_with_traffic | field_noise | openai/whisper-1 | 5.3% | 5/5 (100%) | 2384 | $0.0024 |
| clip04_outdoor_wind_or_fan | field_noise | deepgram/nova-3 | 3.6% | 5/5 (100%) | 2869 | $0.0014 |
| clip04_outdoor_wind_or_fan | field_noise | openai/whisper-1 | 7.1% | 5/5 (100%) | 4574 | $0.0019 |
| clip05_indian_english_natural | accent | deepgram/nova-3 | 4.8% | 4/4 (100%) | 3241 | $0.0019 |
| clip05_indian_english_natural | accent | openai/whisper-1 | 6.5% | 2/4 (50%) | 3275 | $0.0026 |
| clip06_partial_interrupted | partial | deepgram/nova-3 | 0.0% | 2/2 (100%) | 3159 | $0.0022 |
| clip06_partial_interrupted | partial | openai/whisper-1 | 1.5% | 2/2 (100%) | 3874 | $0.0030 |
| clip07_quiet_but_proper_names | names_numbers | deepgram/nova-3 | 18.2% | 5/6 (83%) | 11244 | $0.0015 |
| clip07_quiet_but_proper_names | names_numbers | openai/whisper-1 | 18.2% | 5/6 (83%) | 2428 | $0.0022 |
| clip08_quiet_homeowner_audible | field_noise | deepgram/nova-3 | 12.7% | 3/3 (100%) | 4812 | $0.0026 |
| clip08_quiet_homeowner_audible | field_noise | openai/whisper-1 | 16.4% | 3/3 (100%) | 3987 | $0.0036 |
| clip09_short_command_style | domain_vocab | deepgram/nova-3 | 18.5% | 4/5 (80%) | 1594 | $0.0014 |
| clip09_short_command_style | domain_vocab | openai/whisper-1 | 14.8% | 4/5 (80%) | 4071 | $0.0020 |
| clip10_long_narrative | baseline | deepgram/nova-3 | 2.8% | 6/6 (100%) | 12905 | $0.0046 |
| clip10_long_narrative | baseline | openai/whisper-1 | 2.1% | 6/6 (100%) | 9332 | $0.0064 |

## Aggregate by provider

| Provider | Mean WER | Mean term recall | Mean latency | Total cost |
|---|---:|---:|---:|---:|
| deepgram/nova-3 | 7.8% | 93% | 5762ms | $0.0214 |
| openai/whisper-1 | 9.5% | 89% | 4422ms | $0.0299 |

## Aggregate by category

### baseline
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 4.4% | 86% |
| openai/whisper-1 | 7.1% | 91% |

### domain_vocab
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 13.9% | 86% |
| openai/whisper-1 | 12.8% | 86% |

### field_noise
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 6.0% | 100% |
| openai/whisper-1 | 9.6% | 100% |

### accent
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 4.8% | 100% |
| openai/whisper-1 | 6.5% | 50% |

### partial
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 0.0% | 100% |
| openai/whisper-1 | 1.5% | 100% |

### names_numbers
| Provider | Mean WER | Mean term recall |
|---|---:|---:|
| deepgram/nova-3 | 18.2% | 83% |
| openai/whisper-1 | 18.2% | 83% |

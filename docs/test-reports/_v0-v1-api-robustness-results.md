### V1 single (18/18 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 1 | create | PASS | 201 | 707 |
| 2 | get by id | PASS | 200 | 640 |
| 3 | edit attributes | PASS | 200 | 1093 |
| 4 | toggle done zero-duration | PASS | 200 | 1537 |
| 5 | time_records has 1 zero-duration entry | PASS | 200 | 639 |
| 6 | toggle undone | PASS | 200 | 1087 |
| 7 | after undone — time_records empty | PASS | 200 | 639 |
| 8 | timer complete real duration | PASS | 200 | 1737 |
| 9 | timer session written | PASS | 200 | 642 |
| 10 | last_duration_ms computed | PASS | 200 | 642 |
| 11 | is_zero_duration false | PASS | 200 | 642 |
| 12 | soft delete | PASS | 200 | 882 |
| 13 | after delete — instance returns with deleted:true (not 404) | PASS | 200 | 664 |
| 14 | appears in trash | PASS | 200 | 849 |
| 15 | restore from trash | PASS | 200 | 879 |
| 16 | restored — deleted flag cleared | PASS | 200 | 638 |
| 17 | permanent delete | PASS | 200 | 671 |
| 18 | permanent deleted — 404 | PASS | 404 | 639 |

### V1 recurring (18/18 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 19 | create daily interval=1 | PASS | 201 | 919 |
| 20 | expand date+0 | PASS | 200 | 1295 |
| 21 | expand date+1 | PASS | 200 | 1309 |
| 22 | expand date+2 | PASS | 200 | 1299 |
| 23 | expand date+3 | PASS | 200 | 1325 |
| 24 | expand date+4 | PASS | 200 | 1310 |
| 25 | change interval 1→2 (all) | PASS | 200 | 1793 |
| 26 | interval=2 — date+5 NOT generated | PASS | 200 | 1307 |
| 27 | interval=2 — date+6 IS generated | PASS | 200 | 1305 |
| 28 | update scope=this | PASS | 200 | 1535 |
| 29 | scope=this — date+4 unchanged text | PASS | 200 | 1535 |
| 30 | update search_terms scope=all | PASS | 200 | 1771 |
| 31 | update time scope=all | PASS | 200 | 1778 |
| 32 | time applied to future expansion | PASS | 200 | 1778 |
| 33 | toggle done instance | PASS | 200 | 1532 |
| 34 | delete scope=thisAndFuture | PASS | 200 | 1637 |
| 35 | thisAndFuture delete — date+6 NOT expanded | PASS | 200 | 1077 |
| 36 | cleanup scope=all | PASS | 200 | 1331 |

### V1 fragment (24/24 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 37 | create with empty date | PASS | 201 | 675 |
| 38 | floating visible on date+0 | PASS | 200 | 1056 |
| 39 | floating visible on date+1 | PASS | 200 | 1065 |
| 40 | floating visible on date+5 | PASS | 200 | 1065 |
| 41 | toggle done (with body.date) freezes date | PASS | 200 | 1525 |
| 42 | after done — date frozen to today | PASS | 200 | 637 |
| 43 | completed fragment not visible on tomorrow | PASS | 200 | 1070 |
| 44 | toggle undone | PASS | 200 | 1097 |
| 45 | after undone — date restored to fragment_anchor (empty) | PASS | 200 | 641 |
| 46 | create with anchor date+2 | PASS | 201 | 674 |
| 47 | anchored+2 NOT visible date+0 | PASS | 200 | 1090 |
| 48 | anchored+2 NOT visible date+1 | PASS | 200 | 1454 |
| 49 | anchored+2 visible date+2 | PASS | 200 | 1067 |
| 50 | anchored+2 visible date+5 | PASS | 200 | 1060 |
| 51 | anchored+2 visible date+10 | PASS | 200 | 1305 |
| 52 | TIMER_RECORD #1 ok | PASS | 200 | 1081 |
| 53 | TIMER_RECORD ×7 — no FIFO truncation (len ≥ 7) | PASS | 200 | 641 |
| 54 | after TIMER_RECORD — done still false | PASS | 200 | 641 |
| 55 | TIMER_COMPLETE marks done + records session | PASS | 200 | 1325 |
| 56 | TIMER_COMPLETE — done=true, date frozen to today | PASS | 200 | 644 |
| 57 | soft delete | PASS | 200 | 879 |
| 58 | restore (no template path) | PASS | 200 | 886 |
| 59 | restored visible | PASS | 200 | 633 |
| 60 | edit attributes | PASS | 200 | 1084 |

### V0 single (17/17 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 61 | create | PASS | 200 | 668 |
| 62 | appears in /api/todos | PASS | 200 | 849 |
| 63 | update attributes | PASS | 200 | 880 |
| 64 | edit reflected | PASS | 200 | 848 |
| 65 | toggle done zero-duration | PASS | 200 | 1202 |
| 66 | after toggle — done=true, 1 zero-duration record | PASS | 200 | 848 |
| 67 | toggle undone | PASS | 200 | 867 |
| 68 | after undone — time_records cleared | PASS | 200 | 848 |
| 69 | TIMER_COMPLETE real duration | PASS | 200 | 1535 |
| 70 | timer session written | PASS | 200 | 842 |
| 71 | soft delete | PASS | 200 | 875 |
| 72 | gone from active list | PASS | 200 | 844 |
| 73 | appears in /api/trash | PASS | 200 | 645 |
| 74 | restore from trash | PASS | 200 | 876 |
| 75 | visible after restore | PASS | 200 | 838 |
| 76 | permanent delete | PASS | 200 | 670 |
| 77 | gone permanently | PASS | 200 | 844 |

### V0 recurring (17/17 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 78 | create daily interval=1 | PASS | 200 | 907 |
| 79 | expand date+0 | PASS | 200 | 846 |
| 80 | expand date+1 | PASS | 200 | 1904 |
| 81 | expand date+2 | PASS | 200 | 1480 |
| 82 | expand date+3 | PASS | 200 | 2116 |
| 83 | expand date+4 | PASS | 200 | 1212 |
| 84 | change interval 1→2 (all) | PASS | 200 | 1559 |
| 85 | interval=2 date+5 NOT generated | PASS | 200 | 877 |
| 86 | interval=2 date+6 IS generated | PASS | 200 | 1090 |
| 87 | update search_terms scope=all | PASS | 200 | 1565 |
| 88 | update time scope=all | PASS | 200 | 1531 |
| 89 | future instance time updated | PASS | 200 | 1531 |
| 90 | update scope=this | PASS | 200 | 1326 |
| 91 | scope=this — date+4 unchanged | PASS | 200 | 1326 |
| 92 | delete scope=thisAndFuture | PASS | 200 | 1598 |
| 93 | thisAndFuture delete — date+8 NOT expanded | PASS | 200 | 1096 |
| 94 | cleanup | PASS | 200 | 0 |

### V0 fragment (26/26 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 95 | create floating | PASS | 200 | 675 |
| 96 | floating visible date+0 | PASS | 200 | 848 |
| 97 | floating visible date+1 | PASS | 200 | 1086 |
| 98 | floating visible date+5 | PASS | 200 | 1107 |
| 99 | floating visible date+10 | PASS | 200 | 846 |
| 100 | toggle done zero-duration | PASS | 200 | 1084 |
| 101 | done — date frozen to today | PASS | 200 | 876 |
| 102 | done — not visible on tomorrow | PASS | 200 | 846 |
| 103 | toggle undone | PASS | 200 | 875 |
| 104 | undone — visible again (date restored) | PASS | 200 | 1089 |
| 105 | create anchored +3 | PASS | 200 | 666 |
| 106 | anchored+3 NOT visible date+0 | PASS | 200 | 849 |
| 107 | anchored+3 NOT visible date+1 | PASS | 200 | 845 |
| 108 | anchored+3 NOT visible date+2 | PASS | 200 | 849 |
| 109 | anchored+3 visible date+3 | PASS | 200 | 1096 |
| 110 | anchored+3 visible date+7 | PASS | 200 | 1086 |
| 111 | anchored+3 visible date+14 | PASS | 200 | 1093 |
| 112 | TIMER_RECORD #1 ok | PASS | 200 | 1079 |
| 113 | TIMER_RECORD ×7 — no FIFO truncation (len ≥ 7) | PASS | 200 | 852 |
| 114 | TIMER_COMPLETE freezes date + done | PASS | 200 | 1329 |
| 115 | TIMER_COMPLETE — visible on today, done=true | PASS | 200 | 844 |
| 116 | soft delete | PASS | 200 | 884 |
| 117 | restore (no template path) | PASS | 200 | 872 |
| 118 | restored visible | PASS | 200 | 849 |
| 119 | edit attributes | PASS | 200 | 1084 |
| 120 | edit reflected | PASS | 200 | 841 |

### Robustness (12/14 pass)

| # | Name | Result | HTTP | ms |
|---|------|--------|------|-----|
| 121 | V0 CREATE without top-level date — graceful 400 (not 500) | FAIL | 500 | 430 |
| 122 | V0 CREATE with empty task.id — 400 | PASS | 400 | 424 |
| 123 | V0 CREATE with empty task.text — 400 | PASS | 400 | 432 |
| 124 | V0 CREATE invalid repeat_type — 400 | PASS | 400 | 430 |
| 125 | V0 UPDATE invalid scope — 400 | PASS | 400 | 629 |
| 126 | V0 UPDATE scope=all without parent_id — graceful (400 or 200, NOT 500) | FAIL | 500 | 881 |
| 127 | V1 GET nonexistent todo — 404 | PASS | 404 | 638 |
| 128 | V1 POST todos missing date — 400 | PASS | 400 | 427 |
| 129 | V1 POST todos missing text — 400 | PASS | 400 | 427 |
| 130 | V1 invalid API key — 401 | PASS | 401 | 218 |
| 131 | V1 fragment future body.date clamped to today | PASS | 200 | 1531 |
| 132 | V1 fragment date NOT in future (clamped) | PASS | 200 | 640 |
| 133 | V1 toggle bad record (s>e) — still toggles, skips record | PASS | 200 | 1091 |
| 134 | V0 TIMER_RECORD on non-fragment — downgraded (no-op) | PASS | 200 | 630 |

### Summary

- Total: 134
- Pass: 132 (98%)
- Fail: 2

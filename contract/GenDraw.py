# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

# (Same WORDS list as before — keep the full 440+ word pool)
WORDS = [
    "DOG","CAT","ELEPHANT","TIGER","RABBIT","HORSE","FISH","BIRD",
    "SNAKE","MONKEY","LION","BEAR","PENGUIN","DOLPHIN","OWL",
    "BUTTERFLY","TURTLE","FROG","CHICKEN","COW","PIG","SHEEP",
    "GOAT","DUCK","GOOSE","EAGLE","PARROT","PEACOCK","FLAMINGO",
    "OCTOPUS","CRAB","LOBSTER","SHARK","WHALE","JELLYFISH",
    "SPIDER","ANT","BEE","LADYBUG","SNAIL",
    "PIZZA","BURGER","APPLE","BANANA","BREAD","CAKE","CHEESE",
    "COOKIE","DONUT","SUSHI","PASTA","TACO","EGG","CARROT",
    "ORANGE","GRAPES","STRAWBERRY","WATERMELON","PINEAPPLE",
    "LEMON","AVOCADO","TOMATO","POTATO","CORN","MUSHROOM",
    "ICECREAM","CANDY","CHOCOLATE","POPCORN","FRIES","HOTDOG",
    "SANDWICH","SOUP","SALAD","MILK","COFFEE","TEA","JUICE",
    "WATER","WINE",
    "SOCCER","BASKETBALL","TENNIS","GOLF","BASEBALL","BOXING",
    "SWIMMING","SKIING","SURFING","CHESS","FOOTBALL","VOLLEYBALL",
    "HOCKEY","CYCLING","RUNNING","DANCING","BOWLING","ARCHERY",
    "FISHING","CLIMBING",
    "CHAIR","TABLE","PHONE","LAPTOP","BOOK","CLOCK","GUITAR",
    "PIANO","CAMERA","UMBRELLA","GLASSES","BACKPACK","KEY","LAMP",
    "MIRROR","BED","SOFA","PILLOW","BLANKET","CURTAIN","DOOR",
    "WINDOW","FORK","SPOON","KNIFE","PLATE","CUP","BOTTLE",
    "BOWL","PAN","TOOTHBRUSH","SOAP","COMB","SCISSORS","PEN",
    "PENCIL","PAPER","ENVELOPE","STAMP","RULER",
    "TREE","FLOWER","SUN","MOON","STAR","CLOUD","MOUNTAIN",
    "RIVER","BEACH","RAINBOW","FIRE","SNOWFLAKE","VOLCANO",
    "OCEAN","DESERT","FOREST","ISLAND","WATERFALL","CAVE",
    "ICEBERG","LIGHTNING","TORNADO","ROCK","LEAF","MUSHROOMTREE",
    "CACTUS","GRASS","SAND","WAVE","WIND",
    "CAR","BICYCLE","AIRPLANE","BOAT","TRAIN","ROCKET","BUS",
    "HOUSE","CASTLE","SCHOOL","BRIDGE","PYRAMID","TRUCK",
    "TRACTOR","HELICOPTER","SUBMARINE","SCOOTER","SKATEBOARD",
    "MOTORCYCLE","TAXI","AMBULANCE","FIRETRUCK","TENT","IGLOO",
    "BARN","WINDMILL","LIGHTHOUSE","TOWER","CHURCH","STADIUM",
    "EYE","HAND","FOOT","HEART","BRAIN","NOSE","MOUTH","EAR",
    "TOOTH","HAIR","FINGER","ARM","LEG","DOCTOR","TEACHER",
    "FARMER","ARTIST","POLICE","CHEF","PILOT",
    "BALL","KITE","BALLOON","ROBOT","DRUM","TRUMPET","VIOLIN",
    "FLUTE","MICROPHONE","HEADPHONES","TELEVISION","RADIO",
    "WATCH","RING","CROWN","TREASURE","MAP","COMPASS","ANCHOR",
    "FLAG","GHOST","ALIEN","DRAGON","UNICORN","MERMAID","WIZARD",
    "PIRATE","NINJA","SUPERHERO","CLOWN",
    "AFGHANISTAN","ALBANIA","ALGERIA","ANDORRA","ANGOLA",
    "ARGENTINA","ARMENIA","AUSTRALIA","AUSTRIA","AZERBAIJAN",
    "BAHAMAS","BAHRAIN","BANGLADESH","BARBADOS","BELARUS",
    "BELGIUM","BELIZE","BENIN","BHUTAN","BOLIVIA",
    "BOSNIA","BOTSWANA","BRAZIL","BRUNEI","BULGARIA",
    "BURKINA","BURUNDI","CAMBODIA","CAMEROON","CANADA",
    "CHAD","CHILE","CHINA","COLOMBIA","COMOROS",
    "CONGO","COSTARICA","CROATIA","CUBA","CYPRUS",
    "CZECHIA","DENMARK","DJIBOUTI","DOMINICA","ECUADOR",
    "EGYPT","ERITREA","ESTONIA","ETHIOPIA","FIJI",
    "FINLAND","FRANCE","GABON","GAMBIA","GEORGIA",
    "GERMANY","GHANA","GREECE","GRENADA","GUATEMALA",
    "GUINEA","GUYANA","HAITI","HONDURAS","HUNGARY",
    "ICELAND","INDIA","INDONESIA","IRAN","IRAQ",
    "IRELAND","ISRAEL","ITALY","JAMAICA","JAPAN",
    "JORDAN","KAZAKHSTAN","KENYA","KIRIBATI","KUWAIT",
    "KYRGYZSTAN","LAOS","LATVIA","LEBANON","LESOTHO",
    "LIBERIA","LIBYA","LIECHTENSTEIN","LITHUANIA","LUXEMBOURG",
    "MADAGASCAR","MALAWI","MALAYSIA","MALDIVES","MALI",
    "MALTA","MAURITANIA","MAURITIUS","MEXICO","MICRONESIA",
    "MOLDOVA","MONACO","MONGOLIA","MONTENEGRO","MOROCCO",
    "MOZAMBIQUE","MYANMAR","NAMIBIA","NAURU","NEPAL",
    "NETHERLANDS","NICARAGUA","NIGER","NIGERIA","NORWAY",
    "OMAN","PAKISTAN","PALAU","PANAMA","PARAGUAY",
    "PERU","PHILIPPINES","POLAND","PORTUGAL","QATAR",
    "ROMANIA","RUSSIA","RWANDA","SAMOA","SENEGAL",
    "SERBIA","SEYCHELLES","SINGAPORE","SLOVAKIA","SLOVENIA",
    "SOMALIA","SPAIN","SRILANKA","SUDAN","SURINAME",
    "SWEDEN","SWITZERLAND","SYRIA","TAJIKISTAN","TANZANIA",
    "THAILAND","TOGO","TONGA","TUNISIA","TURKEY",
    "TURKMENISTAN","TUVALU","UGANDA","UKRAINE","URUGUAY",
    "UZBEKISTAN","VANUATU","VENEZUELA","VIETNAM","YEMEN",
    "ZAMBIA","ZIMBABWE","USA","UK","UAE",
    "VATICAN","PALESTINE","TAIWAN","KOSOVO","ESWATINI",
    "SOUTHKOREA","NORTHKOREA","SOUTHAFRICA","NEWZEALAND",
    "DOMINICANREPUBLIC","SAUDIARABIA","TRINIDAD","ELSALVADOR",
    "EQUATORIALGUINEA","PAPUANEWGUINEA","SOLOMONS","CAPEVERDE",
    "MARSHALL","ANTIGUA","STKITTS","STLUCIA","STVINCENT",
    "MACEDONIA","TIMOR","CENTRALAFRICA","IVORYCOAST",
]

WORDS_SET = {w: True for w in WORDS}

RECENT_WINDOW = 20
GUESS_POINTS  = 100
DRAWER_BONUS  = 30
MAX_ATTEMPTS  = 5


def _exact_match(word: str, guess: str) -> bool:
    """
    Fast deterministic pre-check before calling the LLM.
    Handles exact match and simple plurals only.
    If this returns True we skip the LLM call entirely.
    """
    w = word.strip().upper().replace(" ", "")
    g = guess.strip().upper().replace(" ", "")
    if w == g:
        return True
    if w + "S" == g or w == g + "S":
        return True
    if w + "ES" == g or w == g + "ES":
        return True
    return False


def _compact_text(s: str) -> str:
    out = ""
    for ch in s.upper():
        c = ord(ch)
        if (65 <= c <= 90) or (48 <= c <= 57):
            out += ch
    return out


def _hint_reveals_word(word: str, hint: str) -> bool:
    """
    Deterministic guard before validator consensus.
    Blocks exact answer leaks without spending an LLM call.
    """
    secret = _compact_text(word)
    if not secret:
        return False

    compact_hint = _compact_text(hint)
    if compact_hint == secret:
        return True

    token = ""
    for ch in hint.upper():
        c = ord(ch)
        if (65 <= c <= 90) or (48 <= c <= 57):
            token += ch
        else:
            if token == secret:
                return True
            token = ""
    if token == secret:
        return True

    if len(secret) >= 4 and secret in compact_hint:
        return True

    return False


def _hash_to_int(s: str) -> int:
    h = 14695981039346656037
    for ch in s:
        h ^= ord(ch)
        h = (h * 1099511628211) & 0xFFFFFFFFFFFFFFFF
    return h


def _is_alpha(s: str) -> bool:
    if not s: return False
    for ch in s:
        c = ord(ch)
        if not (65 <= c <= 90):
            return False
    return True


class GenDraw(gl.Contract):
    rooms:           TreeMap[str, str]
    room_words:      TreeMap[str, str]
    room_hints:      TreeMap[str, str]
    room_used:       TreeMap[str, str]
    pool:            TreeMap[u256, str]
    pool_member:     TreeMap[str, u256]
    pool_size:       u256
    recent_words:    str
    player_scores:   TreeMap[str, u256]
    weekly_scores:   TreeMap[str, u256]
    week_players:    TreeMap[u256, str]
    # Manual epoch counter — incremented by `advance_week()` (owner only).
    # GenVM does not expose a deterministic timestamp, so we cannot run
    # an automatic 7-day rollover. The owner advances this when they
    # want to reset the leaderboard.
    current_week:    u256
    room_count:      u256
    total_games:     u256
    owner:           Address

    def __init__(self):
        self.owner        = gl.message.sender_address
        self.room_count   = u256(0)
        self.total_games  = u256(0)
        self.pool_size    = u256(0)
        self.recent_words = "[]"
        self.current_week = u256(0)

    # ── helpers ───────────────────────────────────────────────────────

    def _word_at(self, idx: int) -> str:
        seed_n = len(WORDS)
        if idx < seed_n:
            return WORDS[idx]
        return self.pool[u256(idx - seed_n)]

    def _push_recent(self, w: str) -> None:
        arr = json.loads(self.recent_words)
        arr = [x for x in arr if x != w]
        arr.append(w)
        if len(arr) > RECENT_WINDOW:
            arr = arr[-RECENT_WINDOW:]
        self.recent_words = json.dumps(arr)

    def _pick_word(self, room_id: str, turn: int) -> str:
        used_raw = self.room_used[room_id] if room_id in self.room_used else "[]"
        used = {w: True for w in json.loads(used_raw)}
        recent = {w: True for w in json.loads(self.recent_words)}
        seed_n = len(WORDS)
        total  = seed_n + int(self.pool_size)
        if total == 0: return "HOUSE"
        offset = _hash_to_int(room_id + ":" + str(turn)) % total
        for relax in [False, True]:
            for k in range(total):
                i = (offset + k) % total
                w = self._word_at(i)
                if w in used: continue
                if (not relax) and (w in recent): continue
                return w
        return self._word_at(offset)

    def _set_room_word(self, room_id: str, word: str) -> None:
        self.room_words[room_id] = word
        used_raw = self.room_used[room_id] if room_id in self.room_used else "[]"
        used = json.loads(used_raw)
        used.append(word)
        self.room_used[room_id] = json.dumps(used)
        self._push_recent(word)
        self.room_hints[room_id] = self._generate_hint(word)

    def _clean_hint(self, hint: str) -> str:
        out = str(hint).strip().replace("\n", " ").replace("\r", " ")
        if len(out) >= 2:
            quoted = (out[0] == '"' and out[-1] == '"') or (out[0] == "'" and out[-1] == "'")
            if quoted:
                out = out[1:-1].strip()
        while "  " in out:
            out = out.replace("  ", " ")
        return out[:120]

    def _generate_hint(self, word: str) -> str:
        """
        Generate the round clue on-chain with GenLayer consensus.

        Guessers see this via `get_current_hint`; the drawer only sees the
        secret word. This removes the slow per-clue validation loop and
        prevents a drawer from submitting a false or misleading clue.
        """
        word_copy = str(word)

        def generate() -> str:
            return gl.nondet.exec_prompt(
                f"You create one fair clue for a multiplayer drawing "
                f"guessing game.\n"
                f"Secret word: {word_copy}\n\n"
                f"Rules:\n"
                f"- Return one short English clue, 3 to 10 words.\n"
                f"- Do not include the secret word, its plural, a direct "
                f"synonym, translation, first letter, spelling, rhyme, or "
                f"sound-alike hint.\n"
                f"- The clue must be true, commonly associated with the "
                f"secret word, visual enough to help drawing, and still "
                f"require guessing.\n"
                f"- Do not make a false, misleading, impossible, or unrelated "
                f"clue.\n"
                f"- For countries, use a true broad geography clue such as "
                f"continent, region, capital, flag colors, or neighbors, "
                f"without naming the country.\n\n"
                f"Examples:\n"
                f"- UMBRELLA -> Used during rainy weather.\n"
                f"- SCISSORS -> Used to cut paper.\n"
                f"- SUDAN -> A country in northeast Africa.\n\n"
                f"Return only the clue text."
            )

        hint = gl.eq_principle.prompt_non_comparative(
            generate,
            task=(
                f"Generate one fair, truthful, non-revealing clue for the "
                f"secret word '{word_copy}'"
            ),
            criteria=(
                "Accept an output only if it is a short clue, truthful, "
                "commonly related to the secret word, useful for a drawing "
                "game, and does not name or directly reveal the answer. "
                "Reject false, misleading, unrelated, impossible, "
                "spelling/rhyme/first-letter clues, translations, or direct "
                "synonyms."
            ),
        )

        cleaned = self._clean_hint(str(hint))
        if cleaned == "" or _hint_reveals_word(word_copy, cleaned):
            return "Think about its common use or shape."
        return cleaned

    def _save_room(self, room_id: str, room: dict) -> None:
        self.rooms[room_id] = json.dumps(room, sort_keys=True)

    def _all_done(self, room: dict) -> bool:
        non_drawers = [a for a in room["players"].keys() if a != room["current_drawer"]]
        if len(non_drawers) == 0: return True
        attempts = room.get("attempts", {})
        correct  = room.get("correct_this_turn", [])
        for a in non_drawers:
            if a in correct: continue
            if int(attempts.get(a, 0)) >= MAX_ATTEMPTS: continue
            return False
        return True

    def _award_weekly(self, addr: str, pts: int) -> None:
        if pts <= 0: return
        wid = int(self.current_week)
        key = str(wid) + ":" + str(addr)
        prev = int(self.weekly_scores[key]) if key in self.weekly_scores else 0
        self.weekly_scores[key] = u256(prev + pts)
        idx_key = u256(wid)
        idx_raw = self.week_players[idx_key] if idx_key in self.week_players else "[]"
        players = json.loads(idx_raw)
        if addr not in players:
            players.append(addr)
            self.week_players[idx_key] = json.dumps(players)

    def _weekly_leaderboard(self, week_id: int, top_n: int) -> str:
        idx_key = u256(week_id)
        if idx_key not in self.week_players: return "[]"
        players = json.loads(self.week_players[idx_key])
        result = []
        for addr in players:
            key = str(week_id) + ":" + str(addr)
            score = int(self.weekly_scores[key]) if key in self.weekly_scores else 0
            result.append({"address": addr, "score": score})
        result.sort(key=lambda x: x["score"], reverse=True)
        if top_n > 0 and len(result) > top_n:
            result = result[:top_n]
        return json.dumps(result, sort_keys=True)

    def _advance_round(self, room: dict, room_id: str) -> None:
        players = list(room["players"].keys())
        if not players: return
        correct = room.get("correct_this_turn", [])
        if len(correct) > 0:
            drawer = room.get("current_drawer", "")
            if drawer in room["scores"]:
                room["scores"][drawer] = int(room["scores"][drawer]) + DRAWER_BONUS
                self._award_weekly(drawer, DRAWER_BONUS)
        cur = room.get("current_drawer", "")
        try:
            idx = players.index(cur)
        except ValueError:
            idx = -1
        next_idx = (idx + 1) % len(players)
        round_num = int(room["current_round"])
        if next_idx == 0:
            round_num += 1
        if round_num > int(room["rounds"]):
            room["status"] = "finished"
            for addr, pts in room["scores"].items():
                prev = int(self.player_scores[addr]) if addr in self.player_scores else 0
                self.player_scores[addr] = u256(prev + int(pts))
            self.room_hints[room_id] = ""
            return
        turn = int(room.get("turn", 0)) + 1
        room["turn"]              = turn
        room["current_round"]     = round_num
        room["current_drawer"]    = players[next_idx]
        room["correct_this_turn"] = []
        room["attempts"]          = {}
        self._set_room_word(room_id, self._pick_word(room_id, turn))

    # ── public writes ─────────────────────────────────────────────────

    @gl.public.write
    def advance_week(self) -> int:
        """Owner-only: bump the weekly leaderboard epoch. New scores
        from now on are recorded against the next week id; older boards
        remain queryable via `get_weekly_leaderboard_for(week_id, ...)`."""
        if str(gl.message.sender_address) != str(self.owner):
            raise Exception("Only owner can advance the week.")
        self.current_week = u256(int(self.current_week) + 1)
        return int(self.current_week)

    @gl.public.write
    def add_words(self, words: list) -> int:
        """
        Add community words to the pool.

        ── GenLayer consensus used here ──────────────────────────────
        Each submitted word is judged by the validator network's LLM
        to confirm it represents a visual concept that can actually be
        drawn in a Pictionary-style game.  This is a genuinely
        non-deterministic check (different LLMs may disagree on edge
        cases such as abstract nouns) that requires consensus to resolve.
        We use prompt_non_comparative: every validator independently
        evaluates the word against the same criteria and the network
        agrees on the verdict.
        ──────────────────────────────────────────────────────────────
        """
        added = 0
        cap   = 0
        for raw in words:
            cap += 1
            if cap > 20:
                break
            w = str(raw).strip().upper()
            if len(w) < 2 or len(w) > 20:
                continue
            if not _is_alpha(w):
                continue
            if w in WORDS_SET:
                continue
            if w in self.pool_member:
                continue

            # ── GenLayer: LLM judges whether the word is drawable ──
            word_copy = w

            def check_drawable() -> str:
                return gl.nondet.exec_prompt(
                    f"You are a Pictionary game referee.\n"
                    f"Word submitted: {word_copy}\n\n"
                    f"Is this a visual concept that a player could reasonably "
                    f"draw on a whiteboard so that others can guess it?\n\n"
                    f"Examples of DRAWABLE: DOG, HOUSE, PIZZA, RUNNING, DOCTOR\n"
                    f"Examples of NOT DRAWABLE: JUSTICE, INFINITY, ALGORITHM, "
                    f"DEMOCRACY, SADNESS\n\n"
                    f"Reply with ONLY one word: DRAWABLE or NOT_DRAWABLE"
                )

            verdict = gl.eq_principle.prompt_non_comparative(
                check_drawable,
                task=(
                    f"Decide whether the word '{word_copy}' represents "
                    f"a visual concept that can be drawn in Pictionary"
                ),
                criteria=(
                    "Reply DRAWABLE only if the word represents a concrete "
                    "visual object, action, or place. Reply NOT_DRAWABLE for "
                    "abstract concepts, emotions, or ideas that cannot be "
                    "illustrated as a simple drawing."
                ),
            )

            if "NOT_DRAWABLE" in str(verdict).upper():
                continue
            # ── end GenLayer consensus ─────────────────────────────

            i = int(self.pool_size)
            self.pool[u256(i)] = w
            self.pool_member[w] = u256(1)
            self.pool_size = u256(i + 1)
            added += 1
        return added

    @gl.public.write
    def create_room(self, room_name: str, max_players: u256, rounds: u256) -> str:
        if not room_name.strip(): raise Exception("Room name cannot be empty.")
        if int(max_players) < 2 or int(max_players) > 8: raise Exception("Max players must be 2-8.")
        if int(rounds) < 1 or int(rounds) > 10: raise Exception("Rounds must be 1-10.")
        room_id = "room-" + str(int(self.room_count))
        room = {
            "room_id":           room_id,
            "room_name":         str(room_name)[:60],
            "max_players":       int(max_players),
            "rounds":            int(rounds),
            "status":            "waiting",
            "host":              str(gl.message.sender_address),
            "players":           {},
            "scores":            {},
            "current_round":     0,
            "current_drawer":    "",
            "turn":              0,
            "correct_this_turn": [],
            "attempts":          {},
        }
        self._save_room(room_id, room)
        self.room_count = u256(int(self.room_count) + 1)
        return room_id

    @gl.public.write
    def join_room(self, room_id: str, player_name: str) -> None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room = json.loads(self.rooms[room_id])
        if room["status"] != "waiting": raise Exception("Game already started.")
        addr = str(gl.message.sender_address)
        clean = str(player_name).strip()[:32]
        display = clean if clean else addr
        if addr in room["players"]:
            room["players"][addr] = display
            self._save_room(room_id, room)
            return
        if len(room["players"]) >= int(room["max_players"]): raise Exception("Room is full.")
        room["players"][addr] = display
        room["scores"][addr]  = 0
        self._save_room(room_id, room)

    @gl.public.write
    def start_game(self, room_id: str) -> None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room = json.loads(self.rooms[room_id])
        if str(gl.message.sender_address) != room["host"]: raise Exception("Only host can start the game.")
        if len(room["players"]) < 2: raise Exception("Need at least 2 players.")
        if room["status"] != "waiting": raise Exception("Game already started.")
        players = list(room["players"].keys())
        room["status"]            = "playing"
        room["current_round"]     = 1
        room["current_drawer"]    = players[0]
        room["turn"]              = 0
        room["correct_this_turn"] = []
        room["attempts"]          = {}
        self.room_used[room_id] = "[]"
        self._set_room_word(room_id, self._pick_word(room_id, 0))
        self._save_room(room_id, room)
        self.total_games = u256(int(self.total_games) + 1)

    @gl.public.write
    def submit_guess(self, room_id: str, guess: str) -> None:
        """
        Submit a guess for the current word.

        ── GenLayer consensus used here ──────────────────────────────
        After the fast deterministic pre-check (exact match + simple
        plurals) fails, we delegate to the validator network's LLM to
        judge whether the guess is close enough to accept.

        This is the core non-deterministic operation of the game:
        - Two validators might legitimately disagree on whether
          "AUTOMOBILE" is close enough to "CAR".
        - We use prompt_comparative so every validator asks its own LLM
          "is my CORRECT/WRONG verdict equivalent to the leader's?"
          and the network reaches consensus on the final ruling.
        ──────────────────────────────────────────────────────────────
        """
        if room_id not in self.rooms:
            raise Exception("Room not found.")
        room = json.loads(self.rooms[room_id])
        if room["status"] != "playing":
            raise Exception("Game is not active.")
        addr = str(gl.message.sender_address)
        if addr == room["current_drawer"]:
            raise Exception("Drawer cannot guess.")
        if addr not in room["players"]:
            raise Exception("You are not in this room.")
        if room_id not in self.room_words:
            raise Exception("No word set yet.")

        correct  = room.get("correct_this_turn", [])
        if addr in correct:
            return

        attempts = room.get("attempts", {})
        used     = int(attempts.get(addr, 0))
        if used >= MAX_ATTEMPTS:
            raise Exception("No attempts left this turn.")

        attempts[addr]   = used + 1
        room["attempts"] = attempts

        word = str(self.room_words[room_id])

        # ── Step 1: fast deterministic check ──────────────────────
        is_correct = _exact_match(word, guess)

        # ── Step 2: GenLayer LLM consensus for close guesses ──────
        if not is_correct:
            word_copy  = word
            guess_copy = guess.strip().upper()

            def evaluate() -> str:
                return gl.nondet.exec_prompt(
                    f"You are a fair referee in a Pictionary drawing game.\n\n"
                    f"Secret word: {word_copy}\n"
                    f"Player guessed: {guess_copy}\n\n"
                    f"Should this guess be accepted as correct?\n\n"
                    f"Accept if:\n"
                    f"- The guess is the same word with a typo (1 letter off)\n"
                    f"- The guess is a common synonym (e.g. AUTOMOBILE for CAR)\n"
                    f"- The guess is a related form (plural, verb tense)\n"
                    f"- The guess clearly refers to the same drawn object\n\n"
                    f"Reject if:\n"
                    f"- The guess is a completely different concept\n"
                    f"- The guess shares only a vague theme\n\n"
                    f"Reply with ONLY one word: CORRECT or WRONG"
                )

            result = gl.eq_principle.prompt_comparative(
                evaluate,
                principle=(
                    "Both outputs must reach the same CORRECT or WRONG "
                    "verdict. A guess is CORRECT only if it clearly refers "
                    "to the same visual concept as the secret word."
                ),
            )

            is_correct = "CORRECT" in str(result).upper()
        # ── end GenLayer consensus ─────────────────────────────────

        if is_correct:
            room["scores"][addr] = int(room["scores"].get(addr, 0)) + GUESS_POINTS
            self._award_weekly(addr, GUESS_POINTS)
            correct.append(addr)
            room["correct_this_turn"] = correct

        if self._all_done(room):
            self._advance_round(room, room_id)

        self._save_room(room_id, room)

    @gl.public.write
    def end_round(self, room_id: str) -> None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room = json.loads(self.rooms[room_id])
        if str(gl.message.sender_address) != room["host"]: raise Exception("Only host can end round.")
        if room["status"] != "playing": raise Exception("Game is not active.")
        self._advance_round(room, room_id)
        self._save_room(room_id, room)

    # ── public views ──────────────────────────────────────────────────

    @gl.public.view
    def get_room(self, room_id: str) -> str:
        if room_id not in self.rooms: return "{}"
        return self.rooms[room_id]

    @gl.public.view
    def get_current_word(self, room_id: str) -> str:
        if room_id not in self.rooms: return ""
        room = json.loads(self.rooms[room_id])
        if str(gl.message.sender_address) != room["current_drawer"]: return ""
        if room_id not in self.room_words: return ""
        return self.room_words[room_id]

    @gl.public.view
    def get_current_hint(self, room_id: str) -> str:
        if room_id not in self.rooms: return ""
        if room_id not in self.room_hints: return ""
        room = json.loads(self.rooms[room_id])
        addr = str(gl.message.sender_address)
        if room["status"] != "playing": return ""
        if addr == room["current_drawer"]: return ""
        if addr not in room["players"]: return ""
        return self.room_hints[room_id]

    @gl.public.view
    def get_leaderboard(self, room_id: str) -> str:
        if room_id not in self.rooms: return "[]"
        room    = json.loads(self.rooms[room_id])
        scores  = room.get("scores", {})
        players = room.get("players", {})
        result  = []
        for addr, pts in scores.items():
            result.append({
                "address": addr,
                "name":    players.get(addr, addr),
                "score":   int(pts),
            })
        result.sort(key=lambda x: x["score"], reverse=True)
        return json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_pool_size(self) -> int:
        return len(WORDS) + int(self.pool_size)

    @gl.public.view
    def get_recent_words(self) -> str:
        return self.recent_words

    @gl.public.view
    def get_room_count(self) -> int:
        return int(self.room_count)

    @gl.public.view
    def get_total_games(self) -> int:
        return int(self.total_games)

    @gl.public.view
    def get_current_week_id(self) -> int:
        return int(self.current_week)

    @gl.public.view
    def get_weekly_leaderboard(self, top_n: u256) -> str:
        return self._weekly_leaderboard(int(self.current_week), int(top_n))

    @gl.public.view
    def get_weekly_leaderboard_for(self, week_id: u256, top_n: u256) -> str:
        return self._weekly_leaderboard(int(week_id), int(top_n))

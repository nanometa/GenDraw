# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

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
    "ICEBERG","LIGHTNING","TORNADO","ROCK","LEAF","CACTUS",
    "GRASS","SAND","WAVE","WIND",
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
    "AFGHANISTAN","ALBANIA","ALGERIA","ARGENTINA","ARMENIA",
    "AUSTRALIA","AUSTRIA","BANGLADESH","BELGIUM","BOLIVIA",
    "BRAZIL","BULGARIA","CAMBODIA","CAMEROON","CANADA",
    "CHILE","CHINA","COLOMBIA","CROATIA","CUBA",
    "CZECHIA","DENMARK","ECUADOR","EGYPT","ETHIOPIA",
    "FINLAND","FRANCE","GERMANY","GHANA","GREECE",
    "GUATEMALA","HUNGARY","ICELAND","INDIA","INDONESIA",
    "IRAN","IRAQ","IRELAND","ISRAEL","ITALY",
    "JAMAICA","JAPAN","JORDAN","KENYA","KUWAIT",
    "LATVIA","LEBANON","LIBYA","LITHUANIA","MALAYSIA",
    "MEXICO","MOLDOVA","MONGOLIA","MOROCCO","MYANMAR",
    "NEPAL","NETHERLANDS","NIGERIA","NORWAY","PAKISTAN",
    "PANAMA","PERU","PHILIPPINES","POLAND","PORTUGAL",
    "QATAR","ROMANIA","RUSSIA","RWANDA","SENEGAL",
    "SERBIA","SINGAPORE","SOMALIA","SPAIN","SUDAN",
    "SWEDEN","SWITZERLAND","SYRIA","TANZANIA","THAILAND",
    "TUNISIA","TURKEY","UGANDA","UKRAINE","URUGUAY",
    "VENEZUELA","VIETNAM","YEMEN","ZAMBIA","ZIMBABWE",
    "USA","UK","UAE","PALESTINE","TAIWAN",
    "SOUTHKOREA","SOUTHAFRICA","NEWZEALAND","SAUDIARABIA",
    "BRAZIL","CANADA","AUSTRALIA","ARGENTINA","EGYPT",
]
RECENT_WINDOW=20; GUESS_POINTS=100; DRAWER_BONUS=30; MAX_ATTEMPTS=5

def _compact(s:str)->str:
    out=""
    for ch in s.upper():
        c=ord(ch)
        if (65<=c<=90) or (48<=c<=57): out+=ch
    return out
def _exact(word:str, guess:str)->bool:
    w=_compact(word); g=_compact(guess)
    return w==g or w+"S"==g or w==g+"S" or w+"ES"==g or w==g+"ES"
def _hint_cheats(word:str, hint:str)->bool:
    secret=_compact(word); h=_compact(hint)
    if not secret: return False
    if h==secret: return True
    token=""
    for ch in hint.upper():
        c=ord(ch)
        if (65<=c<=90) or (48<=c<=57): token+=ch
        else:
            if token==secret: return True
            token=""
    return token==secret or (len(secret)>=4 and secret in h)
def _hash(s:str)->int:
    h=14695981039346656037
    for ch in s:
        h^=ord(ch); h=(h*1099511628211)&0xFFFFFFFFFFFFFFFF
    return h
def _alpha(s:str)->bool:
    if not s: return False
    for ch in s:
        c=ord(ch)
        if not (65<=c<=90): return False
    return True

class GenDraw(gl.Contract):
    rooms: TreeMap[str,str]
    room_words: TreeMap[str,str]
    room_hints: TreeMap[str,str]
    room_used: TreeMap[str,str]
    pool: TreeMap[u256,str]
    pool_member: TreeMap[str,u256]
    pool_size: u256
    recent_words: str
    player_scores: TreeMap[str,u256]
    weekly_scores: TreeMap[str,u256]
    week_players: TreeMap[u256,str]
    current_week: u256
    room_count: u256
    total_games: u256
    owner: Address
    def __init__(self):
        self.owner=gl.message.sender_address; self.room_count=u256(0); self.total_games=u256(0); self.pool_size=u256(0); self.current_week=u256(0); self.recent_words="[]"
    def _word_at(self,i:int)->str:
        return WORDS[i] if i<len(WORDS) else self.pool[u256(i-len(WORDS))]
    def _push_recent(self,w:str)->None:
        a=[x for x in json.loads(self.recent_words) if x!=w]; a.append(w); self.recent_words=json.dumps(a[-RECENT_WINDOW:])
    def _pick_word(self,rid:str,turn:int)->str:
        total=len(WORDS)+int(self.pool_size); used=json.loads(self.room_used[rid]) if rid in self.room_used else []
        if total<=0: return "HOUSE"
        start=_hash(rid+":"+str(turn))%total
        for k in range(total):
            w=self._word_at((start+k)%total)
            if w not in used: return w
        return self._word_at(start)
    def _set_word(self,rid:str,w:str)->None:
        self.room_words[rid]=w; used=json.loads(self.room_used[rid]) if rid in self.room_used else []; used.append(w); self.room_used[rid]=json.dumps(used); self._push_recent(w)
        self.room_hints[rid]=self._make_hint(w)
    def _clean_hint(self,h:str)->str:
        out=str(h).strip().replace("\n"," ").replace("\r"," ")
        if len(out)>=2 and ((out[0]=='"' and out[-1]=='"') or (out[0]=="'" and out[-1]=="'")): out=out[1:-1].strip()
        while "  " in out: out=out.replace("  "," ")
        return out[:120]
    def _make_hint(self,w:str)->str:
        word=str(w)
        def gen()->str: return gl.nondet.exec_prompt(f"You create one fair clue for a multiplayer drawing guessing game.\nSecret word: {word}\nRules:\n- Return one short English clue, 3 to 10 words.\n- Do not include the secret word, its plural, a direct synonym, translation, first letter, spelling, rhyme, or sound-alike hint.\n- The clue must be true, commonly associated with the secret word, visual enough to help drawing, and still require guessing.\n- Do not make a false, misleading, impossible, or unrelated clue.\n- For countries, use a true broad geography clue such as continent, region, capital, flag colors, or neighbors, without naming the country.\nExamples: for UMBRELLA return Used during rainy weather. For SCISSORS return Used to cut paper. For SUDAN return A country in northeast Africa.\nReturn only the clue text.")
        hint=str(gl.eq_principle.prompt_non_comparative(gen,task="Generate one fair, truthful, non-revealing clue for the secret word",criteria="Accept an output only if it is a short clue, truthful, commonly related to the secret word, useful for a drawing game, and does not name or directly reveal the answer. Reject false, misleading, unrelated, impossible, spelling/rhyme/first-letter clues, translations, or direct synonyms."))
        hint=self._clean_hint(hint)
        if hint=="" or _hint_cheats(word,hint): hint="Think about its common use or shape."
        return hint
    def _save(self,rid:str,room:dict)->None:
        self.rooms[rid]=json.dumps(room,sort_keys=True)
    def _all_done(self,room:dict)->bool:
        attempts=room.get("attempts",{}); correct=room.get("correct_this_turn",[])
        for a in room["players"].keys():
            if a!=room["current_drawer"] and a not in correct and int(attempts.get(a,0))<MAX_ATTEMPTS: return False
        return True
    def _award_weekly(self,addr:str,pts:int)->None:
        wid=int(self.current_week); key=str(wid)+":"+addr; self.weekly_scores[key]=u256((int(self.weekly_scores[key]) if key in self.weekly_scores else 0)+pts)
        raw=self.week_players[u256(wid)] if u256(wid) in self.week_players else "[]"; arr=json.loads(raw)
        if addr not in arr: arr.append(addr); self.week_players[u256(wid)]=json.dumps(arr)
    def _weekly(self,wid:int,top:int)->str:
        arr=json.loads(self.week_players[u256(wid)]) if u256(wid) in self.week_players else []; out=[]
        for a in arr:
            k=str(wid)+":"+a; out.append({"address":a,"score":int(self.weekly_scores[k]) if k in self.weekly_scores else 0})
        out.sort(key=lambda x:x["score"],reverse=True); return json.dumps(out[:top] if top>0 else out,sort_keys=True)
    def _advance(self,room:dict,rid:str)->None:
        players=list(room["players"].keys()); drawer=room.get("current_drawer","")
        if len(room.get("correct_this_turn",[]))>0 and drawer in room["scores"]: room["scores"][drawer]=int(room["scores"][drawer])+DRAWER_BONUS; self._award_weekly(drawer,DRAWER_BONUS)
        idx=players.index(drawer) if drawer in players else -1; next_idx=(idx+1)%len(players); rnd=int(room["current_round"])+(1 if next_idx==0 else 0)
        if rnd>int(room["rounds"]):
            room["status"]="finished"
            for a,p in room["scores"].items(): self.player_scores[a]=u256((int(self.player_scores[a]) if a in self.player_scores else 0)+int(p))
            self.room_hints[rid]=""
            return
        room["turn"]=int(room.get("turn",0))+1; room["current_round"]=rnd; room["current_drawer"]=players[next_idx]; room["correct_this_turn"]=[]; room["attempts"]={}; self._set_word(rid,self._pick_word(rid,int(room["turn"])))
    @gl.public.write
    def advance_week(self)->int:
        if str(gl.message.sender_address)!=str(self.owner): raise Exception("Only owner can advance the week.")
        self.current_week=u256(int(self.current_week)+1); return int(self.current_week)
    @gl.public.write
    def add_words(self,words:list)->int:
        added=0
        for raw in words[:20]:
            w=str(raw).strip().upper()
            if 2<=len(w)<=20 and _alpha(w) and w not in WORDS and w not in self.pool_member:
                i=int(self.pool_size); self.pool[u256(i)]=w; self.pool_member[w]=u256(1); self.pool_size=u256(i+1); added+=1
        return added
    @gl.public.write
    def create_room(self,room_name:str,max_players:u256,rounds:u256)->str:
        if not room_name.strip(): raise Exception("Room name cannot be empty.")
        if int(max_players)<2 or int(max_players)>8: raise Exception("Max players must be 2-8.")
        if int(rounds)<1 or int(rounds)>10: raise Exception("Rounds must be 1-10.")
        rid="room-"+str(int(self.room_count)); room={"room_id":rid,"room_name":str(room_name)[:60],"max_players":int(max_players),"rounds":int(rounds),"status":"waiting","host":str(gl.message.sender_address),"players":{},"scores":{},"current_round":0,"current_drawer":"","turn":0,"correct_this_turn":[],"attempts":{}}; self._save(rid,room); self.room_count=u256(int(self.room_count)+1); return rid
    @gl.public.write
    def join_room(self,room_id:str,player_name:str)->None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room=json.loads(self.rooms[room_id]); addr=str(gl.message.sender_address)
        if room["status"]!="waiting": raise Exception("Game already started.")
        if addr not in room["players"] and len(room["players"])>=int(room["max_players"]): raise Exception("Room is full.")
        room["players"][addr]=(str(player_name).strip()[:32] or addr); room["scores"][addr]=int(room["scores"].get(addr,0)); self._save(room_id,room)
    @gl.public.write
    def start_game(self,room_id:str)->None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room=json.loads(self.rooms[room_id])
        if str(gl.message.sender_address)!=room["host"]: raise Exception("Only host can start the game.")
        if len(room["players"])<2: raise Exception("Need at least 2 players.")
        players=list(room["players"].keys()); room["status"]="playing"; room["current_round"]=1; room["current_drawer"]=players[0]; room["turn"]=0; room["correct_this_turn"]=[]; room["attempts"]={}; self.room_used[room_id]="[]"; self._set_word(room_id,self._pick_word(room_id,0)); self._save(room_id,room); self.total_games=u256(int(self.total_games)+1)
    @gl.public.write
    def submit_guess(self,room_id:str,guess:str)->None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room=json.loads(self.rooms[room_id]); addr=str(gl.message.sender_address)
        if room["status"]!="playing": raise Exception("Game is not active.")
        if addr==room["current_drawer"]: raise Exception("Drawer cannot guess.")
        if addr not in room["players"]: raise Exception("You are not in this room.")
        word=str(self.room_words[room_id]); correct=room.get("correct_this_turn",[]); attempts=room.get("attempts",{})
        if addr in correct: return
        if int(attempts.get(addr,0))>=MAX_ATTEMPTS: raise Exception("No attempts left this turn.")
        attempts[addr]=int(attempts.get(addr,0))+1; room["attempts"]=attempts; ok=_exact(word,guess)
        if not ok:
            wc=word; gc=guess.strip().upper()
            def judge()->str: return gl.nondet.exec_prompt(f"Secret word: {wc}\nPlayer guessed: {gc}\nReply CORRECT if it is the same object, typo, plural, or common synonym. Otherwise reply WRONG. One word only.")
            ok="CORRECT" in str(gl.eq_principle.prompt_comparative(judge,principle="Both outputs must give the same CORRECT or WRONG verdict.")).upper()
        if ok: room["scores"][addr]=int(room["scores"].get(addr,0))+GUESS_POINTS; self._award_weekly(addr,GUESS_POINTS); correct.append(addr); room["correct_this_turn"]=correct
        if self._all_done(room): self._advance(room,room_id)
        self._save(room_id,room)
    @gl.public.write
    def end_round(self,room_id:str)->None:
        if room_id not in self.rooms: raise Exception("Room not found.")
        room=json.loads(self.rooms[room_id])
        if str(gl.message.sender_address)!=room["host"]: raise Exception("Only host can end round.")
        if room["status"]!="playing": raise Exception("Game is not active.")
        self._advance(room,room_id); self._save(room_id,room)
    @gl.public.view
    def get_room(self,room_id:str)->str: return self.rooms[room_id] if room_id in self.rooms else "{}"
    @gl.public.view
    def get_current_word(self,room_id:str)->str:
        if room_id not in self.rooms or room_id not in self.room_words: return ""
        return self.room_words[room_id] if str(gl.message.sender_address)==json.loads(self.rooms[room_id])["current_drawer"] else ""
    @gl.public.view
    def get_current_hint(self,room_id:str)->str:
        if room_id not in self.rooms or room_id not in self.room_hints: return ""
        room=json.loads(self.rooms[room_id]); addr=str(gl.message.sender_address)
        if room["status"]!="playing": return ""
        if addr==room["current_drawer"]: return ""
        if addr not in room["players"]: return ""
        return self.room_hints[room_id]
    @gl.public.view
    def get_leaderboard(self,room_id:str)->str:
        if room_id not in self.rooms: return "[]"
        r=json.loads(self.rooms[room_id]); out=[{"address":a,"name":r["players"].get(a,a),"score":int(p)} for a,p in r.get("scores",{}).items()]; out.sort(key=lambda x:x["score"],reverse=True); return json.dumps(out,sort_keys=True)
    @gl.public.view
    def get_pool_size(self)->int: return len(WORDS)+int(self.pool_size)
    @gl.public.view
    def get_recent_words(self)->str: return self.recent_words
    @gl.public.view
    def get_room_count(self)->int: return int(self.room_count)
    @gl.public.view
    def get_total_games(self)->int: return int(self.total_games)
    @gl.public.view
    def get_current_week_id(self)->int: return int(self.current_week)
    @gl.public.view
    def get_weekly_leaderboard(self,top_n:u256)->str: return self._weekly(int(self.current_week),int(top_n))
    @gl.public.view
    def get_weekly_leaderboard_for(self,week_id:u256,top_n:u256)->str: return self._weekly(int(week_id),int(top_n))

# -*- coding: utf-8 -*-
"""Generate Armenian A4 school-cinema plan PDFs."""

from pathlib import Path

from fpdf import FPDF

OUT_DIR = Path(__file__).resolve().parent
FONT = r"C:\Windows\Fonts\sylfaen.ttf"
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"  # fallback metrics; Sylfaen has no bold file

# Warm cinema palette
CREAM = (247, 240, 230)
INK = (42, 28, 24)
WINE = (110, 36, 40)
TERRACOTTA = (166, 74, 52)
GOLD = (184, 140, 74)
SOFT = (232, 220, 204)
MUTED = (110, 90, 80)


class CinemaPDF(FPDF):
    def __init__(self, subtitle: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.subtitle = subtitle
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("Sylfaen", "", FONT)
        # Use Sylfaen for "bold" too (drawn larger / wine color) — Arial Bold lacks Armenian
        self.add_font("Sylfaen", "B", FONT)
        self.set_margins(16, 16, 16)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*CREAM)
        self.rect(0, 0, 210, 297, "F")
        self.set_draw_color(*GOLD)
        self.set_line_width(0.4)
        self.line(16, 12, 194, 12)
        self.set_font("Sylfaen", "", 8)
        self.set_text_color(*MUTED)
        self.set_y(5)
        self.cell(0, 5, self.subtitle, align="R")
        self.ln(8)

    def footer(self):
        self.set_y(-14)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.3)
        self.line(16, self.get_y(), 194, self.get_y())
        self.set_y(-12)
        self.set_font("Sylfaen", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"{self.page_no()}", align="C")

    def paint_background(self):
        self.set_fill_color(*CREAM)
        self.rect(0, 0, 210, 297, "F")

    def cover_band(self, title: str, tagline: str):
        self.paint_background()
        # Top wine band
        self.set_fill_color(*WINE)
        self.rect(0, 0, 210, 48, "F")
        self.set_fill_color(*GOLD)
        self.rect(0, 48, 210, 2.2, "F")

        self.set_xy(16, 14)
        self.set_font("Sylfaen", "", 11)
        self.set_text_color(255, 245, 235)
        self.cell(0, 6, "Մարտունի · կինոթատրոն × դպրոց", align="L")

        self.set_xy(16, 24)
        self.set_font("Sylfaen", "", 22)
        self.set_text_color(255, 250, 245)
        self.multi_cell(178, 9, title, align="L")

        self.set_xy(16, 58)
        self.set_font("Sylfaen", "", 11)
        self.set_text_color(*TERRACOTTA)
        self.multi_cell(178, 6, tagline, align="L")
        self.ln(4)

    def section_title(self, number: str, title: str):
        self.ln(3)
        y = self.get_y()
        self.set_fill_color(*WINE)
        self.rect(16, y, 7, 7, "F")
        self.set_xy(16, y + 0.8)
        self.set_font("Sylfaen", "", 10)
        self.set_text_color(255, 250, 245)
        self.cell(7, 5.5, number, align="C")
        self.set_xy(26, y)
        self.set_font("Sylfaen", "", 14)
        self.set_text_color(*WINE)
        self.cell(0, 7, title, align="L")
        self.ln(9)
        self.set_draw_color(*SOFT)
        self.set_line_width(0.5)
        self.line(16, self.get_y(), 194, self.get_y())
        self.ln(4)

    def body(self, text: str, size: int = 10.5, leading: float = 5.8):
        self.set_font("Sylfaen", "", size)
        self.set_text_color(*INK)
        self.multi_cell(178, leading, text, align="L")
        self.ln(1.5)

    def bullet(self, text: str, indent: float = 4):
        x = self.l_margin
        y = self.get_y()
        self.set_fill_color(*GOLD)
        self.ellipse(x + 1, y + 2, 2.2, 2.2, "F")
        self.set_xy(x + indent + 2, y)
        self.set_font("Sylfaen", "", 10.5)
        self.set_text_color(*INK)
        self.multi_cell(178 - indent - 2, 5.6, text, align="L")
        self.ln(1)

    def card(self, lines: list[str], accent=TERRACOTTA):
        # Measure height
        start_y = self.get_y()
        self.set_font("Sylfaen", "", 10.5)
        # Estimate: 6mm per line + padding
        h = 8 + len(lines) * 6.2
        if start_y + h > 275:
            self.add_page()
            self.paint_background()
            start_y = self.get_y()

        self.set_fill_color(255, 252, 247)
        self.set_draw_color(*accent)
        self.set_line_width(0.6)
        self.rect(16, start_y, 178, h, "FD")
        self.set_fill_color(*accent)
        self.rect(16, start_y, 2.5, h, "F")

        self.set_xy(24, start_y + 3)
        self.set_text_color(*INK)
        for line in lines:
            self.set_x(24)
            self.multi_cell(164, 5.8, line, align="L")
        self.set_y(start_y + h + 3)

    def step_block(self, num: str, title: str, detail: str):
        y = self.get_y()
        if y > 250:
            self.add_page()
            self.paint_background()
            y = self.get_y()

        self.set_fill_color(*WINE)
        self.ellipse(16.5, y + 0.5, 8, 8, "F")
        self.set_xy(16.5, y + 1.6)
        self.set_font("Sylfaen", "", 11)
        self.set_text_color(255, 250, 245)
        self.cell(8, 6, num, align="C")

        self.set_xy(28, y)
        self.set_font("Sylfaen", "", 12)
        self.set_text_color(*WINE)
        self.cell(0, 6, title)
        self.ln(6.5)
        self.set_x(28)
        self.set_font("Sylfaen", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(166, 5.4, detail, align="L")
        self.ln(3.5)

    def tiny_label(self, text: str):
        self.set_font("Sylfaen", "", 8.5)
        self.set_text_color(*MUTED)
        self.cell(0, 5, text)
        self.ln(5)


def build_program_pdf() -> Path:
    pdf = CinemaPDF("Դպրոց-կինոթատրոն համագործակցության ծրագիր")
    pdf.add_page()
    pdf.cover_band(
        "Դպրոց-կինոթատրոն\nհամագործակցության ծրագիր",
        "Մարտունիի անկախ կինոթատրոնի շահութաբերության և դպրոցների համար գրավիչ առաջարկի մոդել",
    )

    # Section 1
    pdf.section_title("01", "Բիզնես մոդել")
    pdf.body(
        "Դպրոցական տոմսի գինը՝ 1 000 դրամ։ Եկամուտը բաշխվում է պարզ և թափանցիկ կանոնով՝ "
        "դպրոցը ստանում է միայն իր վաճառած տոմսերից մասնաբաժին։"
    )
    pdf.card(
        [
            "Դպրոցական տոմս՝ 1 000 դրամ",
            "Դպրոցին՝ 300 դրամ / տոմս (միայն դպրոցի վաճառած տոմսերից)",
            "Կինոթատրոնին՝ 700 դրամ / տոմս",
            "Դիստրիբյուտորի տոկոս չկա՝ հին սելիբ / կատալոգային ֆիլմեր",
            "Բուֆետի եկամուտը՝ 100%-ով կինոթատրոնին",
        ]
    )
    pdf.body(
        "Այս կառուցվածքը դպրոցին տալիս է իրական շահույթ՝ առանց լրացուցիչ բյուրոկրատիայի, "
        "իսկ կինոթատրոնը պահում է հիմնական մարժան և բուֆետը։"
    )

    # Section 2
    pdf.section_title("02", "Դիստրիբյուտորի ռազմավարություն")
    pdf.body(
        "Հոլիվուդյան / կատալոգային ոչ թատերական լիցենզիայի համար դիմել MediaExpert-ին "
        "(ռուսֆիլմ / CIS, այդ թվում՝ Հայաստան)։"
    )
    pdf.bullet("Էլ. փոստ՝ sales@rusfilm.info")
    pdf.bullet("Լրացնել անկետան (rusfilm.info/anketa), ուղարկել սրահի 2–3 լուսանկար և աշխատանքային օրերի դպրոցական ժամանակացույց։")
    pdf.bullet("Խնդրել Վլադիմիրին՝ ֆիքսված կրթական փաթեթ, ոչ թե տոկոսային բաժանում։")
    pdf.card(
        [
            "Նպատակային գին՝ 15 000–25 000 դրամ / ցուցադրություն",
            "Կամ՝ ~80 000 դրամ / ամիս՝ մինչև 4 դպրոցական ցուցադրության համար",
            "Երբեք չհամաձայնել ֆիքսված վճարի վրա տոկոս ավելացնելուն",
            "Պահանջել՝ տոմսերի վաճառքը ինքնուրույն, բուֆետը լիցենզիայից դուրս",
        ],
        accent=GOLD,
    )

    # Section 3
    pdf.section_title("03", "Շուկայի տվյալներ · Մարտունի")
    pdf.body(
        "Մարտունի խոշորացված համայնք (Գեղարքունիք). թվերը պլանավորման միջակայքեր են՝ "
        "հաստատել Գեղարքունիքի կրթության վարչությունից և յուրաքանչյուր դպրոցից։"
    )
    pdf.bullet("Դպրոցներ՝ մոտ 26–29 հանրակրթական")
    pdf.bullet("Աշակերտներ՝ մոտ 10 000–12 500")
    pdf.bullet("Բնակչություն՝ մոտ 79 500 (2024, ԱՎԿ)")
    pdf.bullet("Մոտ գյուղեր (2–6 կմ)՝ Վաղաշեն, Ներքին Գետաշեն, Աստղաձոր")
    pdf.bullet("Հեռավոր լճափնյա գյուղեր՝ 8–15+ կմ")
    pdf.bullet("Գիշերօթիկ / ինտերնատ դպրոցներ չեն հայտնաբերվել")

    # Section 4
    pdf.section_title("04", "Օրինակային հաշվարկ")
    pdf.tiny_label("Պայման՝ 30 աշակերտ × 1 000 դրամ")
    pdf.card(
        [
            "Ընդհանուր եկամուտ՝ 30 000 դրամ",
            "Դպրոցին (300 × 30)՝ 9 000 դրամ",
            "Կինոթատրոնին տոմսերից (700 × 30)՝ 21 000 դրամ",
            "Լիցենզիա՝ 15 000–25 000 դրամ / ցուցադրություն",
            "Տոմսային մարժա լիցենզիայից հետո՝ մոտ −4 000 … +6 000 դրամ",
            "Բուֆետը կարող է ծածկել բացը և ապահովել շահույթ",
        ],
        accent=TERRACOTTA,
    )
    pdf.body(
        "Եզրակացություն՝ սկսել մոտակա դպրոցներից, ֆիքսված լիցենզիայով և բուֆետի նախնական պատվերով։ "
        "Ամեն շաբաթ օրվա ցերեկային / երեկոյան մեկ սլոթը բավարար է փորձարկման համար։"
    )

    pdf.set_y(-28)
    pdf.set_font("Sylfaen", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        178,
        4.5,
        "Փաստաթուղթը նախատեսված է ներքին պլանավորման համար։ Թվերը գնահատական են և պետք է հաստատվեն դաշտային տվյալներով։",
        align="L",
    )

    out = OUT_DIR / "dproc-kino-hamagortcakcutyun.pdf"
    pdf.output(str(out))
    return out


def build_implementation_pdf() -> Path:
    pdf = CinemaPDF("Իրականացման քայլերի պլան · շարունակություն")
    pdf.add_page()
    pdf.cover_band(
        "Իրականացման քայլերի պլան",
        "Դպրոց-կինոթատրոն ծրագրի երկրորդ մաս · փորձարկումից մինչև մասշտաբավորում",
    )

    # Section 1 — six steps
    pdf.section_title("01", "Վեց քայլ")

    pdf.step_block(
        "1",
        "Ընտրել ֆիլմերի ցանկը",
        "Հին սելիբ հայկական կամ կատալոգային ֆիլմեր՝ էժան կամ առանց լիցենզիայի արժեքի։ "
        "Խուսափել նոր թողարկումներից և տոկոսային պրոկատից։",
    )
    pdf.step_block(
        "2",
        "Լրացնել MediaExpert անկետան",
        "Ուղարկել սրահի լուսանկարներ և աշխատանքային օրերի ժամանակացույցը sales@rusfilm.info հասցեին։ "
        "Խնդրել ֆիքսված կրթական փաթեթ՝ 15 000–25 000 դրամ / ցուցադրություն։",
    )
    pdf.step_block(
        "3",
        "Պարզ ծրագրային հաշվառում",
        "Կառուցել պարզ գործիք՝ յուրաքանչյուր ցուցադրության վաճառքը հետևելու համար. "
        "դպրոցի մասնաբաժին՝ 300 դրամ / տոմս, կինոթատրոնի մնացորդ՝ 700 դրամ / տոմս։",
    )
    pdf.step_block(
        "4",
        "Ընտրել 2–3 մոտակա դպրոց",
        "Վաղաշեն, Ներքին Գետաշեն, Աստղաձոր։ Հանդիպել տնօրենների հետ անձամբ՝ պատրաստի առաջարկով, "
        "ոչ թե կարծիք հարցնելով։",
    )
    pdf.step_block(
        "5",
        "Անցկացնել փորձնական ցուցադրություն",
        "Յուրաքանչյուր ընտրված դպրոցի համար՝ մեկ փորձնական ցուցադրություն՝ նախապես համաձայնեցված օրվա և ժամի հետ։",
    )
    pdf.step_block(
        "6",
        "Գնահատել և մասշտաբավորել",
        "Փորձնական ամսից հետո ամփոփել արդյունքները, ապա որոշել ամսական փաթեթի երկարացումը և նոր դպրոցների ընդգրկումը։",
    )

    # Section 2
    pdf.add_page()
    pdf.paint_background()
    pdf.section_title("02", "Փորձնական գնահատման չափորոշիչներ")
    pdf.body("Փորձնական ամսվա վերջում պատասխանել չորս հարցի՝ նախքան ամսական փաթեթը երկարացնելը։")
    pdf.card(
        [
            "Հաճախում՝ փաստացի vs սպասված (օր. 30 աշակերտ)",
            "Դպրոցի հետադարձ կապ՝ տնօրեն / ուսուցիչներ",
            "Եկամուտ մեկ ցուցադրության համար (տոմս + բուֆետ − լիցենզիա)",
            "Արդյո՞ք երկարացնել ամսական փաթեթը",
        ]
    )
    pdf.body(
        "Եթե հաճախումը ≥70% սպասվածից և դպրոցը պատրաստ է կրկնել՝ ամրագրել ամսական 4 ցուցադրության փաթեթ։ "
        "Եթե թույլ է՝ փոխել ֆիլմը, օրը կամ առաջարկի ձևակերպումը՝ նախքան նոր դպրոցներ ավելացնելը։"
    )

    # Section 3
    pdf.section_title("03", "Ռիսկերի նշումներ")
    pdf.bullet("Տոմսերի թվերը գնահատական են՝ ոչ պաշտոնական վիճակագրություն։")
    pdf.bullet("Աշակերտների թիվը հաստատել յուրաքանչյուր դպրոցից՝ հանդիպումից առաջ։")
    pdf.bullet("Սկսել մեկ աշխատանքային երեկոյան սլոթով՝ չծանրաբեռնել ծրագիրը։")
    pdf.bullet("Լիցենզիան պահել ֆիքսված. տոկոսային բանաձևը չեղարկում է մարժան։")
    pdf.bullet("Բուֆետի նախնական պատվերը նվազեցնում է ֆինանսական ռիսկը։")

    pdf.ln(4)
    pdf.card(
        [
            "Պատրաստի առաջարկ դպրոցին՝",
            "Տոմս 1 000 դրամ · դպրոցին 300 դրամ · ուսուցիչը անվճար (1/12)",
            "Օր՝ աշխատանքային · ժամ՝ համաձայնեցված · ֆիլմ՝ կատալոգ / հայկական",
        ],
        accent=GOLD,
    )

    pdf.ln(2)
    pdf.set_font("Sylfaen", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        178,
        4.5,
        "Սա «Դպրոց-կինոթատրոն համագործակցության ծրագիր» փաստաթղթի շարունակությունն է։ "
        "Նախատեսված է ներքին իրականացման համար։",
        align="L",
    )

    out = OUT_DIR / "iraknacman-qayleri-plan.pdf"
    pdf.output(str(out))
    return out


def build_partners_terms_pdf() -> Path:
    """External terms sheet for schools and colleges."""
    pdf = CinemaPDF("Համագործակցության ընդհանուր պայմաններ · դպրոցներ և քոլեջներ")
    pdf.add_page()
    pdf.cover_band(
        "Համագործակցության\nընդհանուր պայմաններ",
        "Մարտունիի կինոթատրոնի առաջարկ դպրոցներին և քոլեջներին · քննարկման հիմք",
    )

    pdf.section_title("01", "Ծրագրի նպատակը")
    pdf.body(
        "Մենք հրավիրում ենք դպրոցներին և քոլեջներին կազմակերպել խմբային կինոդիտումներ "
        "շաբաթվա ցանկացած օր՝ մատչելի գնով, տարիքին համապատասխան ֆիլմերով և պարզ, "
        "թափանցիկ ֆինանսական պայմաններով։ Կինոթատրոնը աշխատում է ամեն օր։ Այս փաստաթուղթը "
        "ընդհանուր պայմանների ամփոփումն է՝ քննարկում սկսելու համար։"
    )

    pdf.section_title("02", "Գներ և բաշխում")
    pdf.body("Դպրոցական / ուսանողական խմբային տոմսի գինը՝ 1 000 դրամ։")
    pdf.card(
        [
            "Տոմս՝ 1 000 դրամ (մեկ աշակերտ / ուսանող)",
            "Ուսումնական հաստատությանը՝ 300 դրամ յուրաքանչյուր իր վաճառած տոմսից",
            "Կինոթատրոնին՝ 700 դրամ յուրաքանչյուր տոմսից",
            "Ուղեկցող ուսուցիչ / դասախոս՝ անվճար (1 անվճար տեղ՝ 12 վճարողի դիմաց)",
        ]
    )
    pdf.body(
        "Կարևոր. 300 դրամի մասնաբաժինը վերաբերում է միայն այն տոմսերին, որոնք վաճառել է "
        "ինքը՝ դպրոցը կամ քոլեջը (խմբային հայտով)։ Կինոթատրոնի դրամարկղից առանձին գնված "
        "տոմսերից հաստատությանը մասնաբաժին չի հաշվարկվում։"
    )

    pdf.section_title("03", "Ինչ է ներառված")
    pdf.bullet("Ամբողջ սրահով կամ խմբային ցուցադրություն՝ համաձայնեցված օր և ժամ")
    pdf.bullet("Տարիքին և ծրագրին համապատասխան ֆիլմեր (հայկական, կատալոգային, կրթական)")
    pdf.bullet("Պարզ հաշվարկ և վճարում խմբային հայտից հետո")
    pdf.bullet("Կարող եք նախապես պատվիրել բուֆետ (փոփկորն, ըմպելիք)՝ առանձին գնով")

    pdf.section_title("04", "Ինչպես է աշխատում")
    pdf.step_block(
        "1",
        "Ընտրում եք օր և խմբի չափ",
        "Կինոթատրոնը բաց է ամեն օր՝ երկուշաբթիից կիրակի։ Նշում եք նախընտրելի օրը և մոտավոր աշակերտների / ուսանողների թիվը։",
    )
    pdf.step_block(
        "2",
        "Համաձայնեցնում ենք ֆիլմը",
        "Առաջարկում ենք ցանկ տարիքային սահմանափակումով։ Կարող եք առաջարկել նաև ձեր նախընտրած վերնագիրը՝ հասանելիության դեպքում։",
    )
    pdf.step_block(
        "3",
        "Հաստատում և այց",
        "Հաստատում եք մասնակիցների թիվը, վճարում եք խմբային գումարը, ստանում եք ձեր մասնաբաժինը՝ ըստ վաճառված տոմսերի։",
    )

    pdf.add_page()
    pdf.paint_background()
    pdf.section_title("05", "Օրինակ")
    pdf.tiny_label("Օրինակ՝ 30 աշակերտ")
    pdf.card(
        [
            "Ընդհանուր վճար՝ 30 × 1 000 = 30 000 դրամ",
            "Դպրոցին / քոլեջին վերադարձ՝ 30 × 300 = 9 000 դրամ",
            "Կինոթատրոնին մնում է տոմսերից՝ 21 000 դրամ",
            "Ուղեկցողներ՝ մինչև 2 անվճար տեղ (30 ÷ 12)",
        ],
        accent=GOLD,
    )

    pdf.section_title("06", "Ընդհանուր կանոններ")
    pdf.bullet("Նվազագույն խումբ՝ ըստ համաձայնեցման (սովորաբար 20+ մասնակից)")
    pdf.bullet("Չեղարկում կամ ժամի փոփոխություն՝ առնվազն 48 ժամ առաջ")
    pdf.bullet("Տարիքային սահմանափակումը պարտադիր է պահպանել")
    pdf.bullet("Լուսանկարում / տեսանկարահանում՝ միայն կինոթատրոնի համաձայնությամբ")
    pdf.bullet("Վերջնական պայմանները կարող են ճշգրտվել գրավոր համաձայնությամբ")

    pdf.section_title("07", "Հաջորդ քայլը")
    pdf.body(
        "Եթե հետաքրքրված եք, կապվեք մեզ հետ՝ նշելով հաստատության անունը, մոտավոր "
        "մասնակիցների թիվը և նախընտրելի օրը։ Կպատրաստենք կոնկրետ առաջարկ ձեր խմբի համար։"
    )
    pdf.card(
        [
            "Մարտունի · կինոթատրոն × դպրոց / քոլեջ",
            "Փաստաթուղթ՝ ընդհանուր պայմաններ · քննարկման հիմք",
            "Վերջնական պայմանագիրը կազմվում է առանձին՝ համաձայնությունից հետո",
        ],
        accent=WINE,
    )

    pdf.ln(2)
    pdf.set_font("Sylfaen", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        178,
        4.5,
        "Այս փաստաթուղթը տեղեկատվական է և չի համարվում պարտադիր պայմանագիր։ "
        "Գները և պայմանները գործում են մինչև առանձին գրավոր փոփոխություն։",
        align="L",
    )

    out = OUT_DIR / "hamagortcakcutyan-yndhanur-paymanner.pdf"
    pdf.output(str(out))
    return out


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "partners":
        print(build_partners_terms_pdf())
    else:
        p1 = build_program_pdf()
        p2 = build_implementation_pdf()
        p3 = build_partners_terms_pdf()
        print(p1)
        print(p2)
        print(p3)

// Created with Squiffy 5.1.1
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '2b45631e89';
squiffy.story.sections = {
	'_default': {
		'text': "<p><p>Era uma das noites mais frias da estação, o chão ainda estava úmido devido a tempestade que horas antes havia atrasado sua jornada. O caminho para o vilarejo de RagFord deveria ser realizado em oito dias e se passava dentro da floresta de Orswick onde várias criaturas misteriosas habitavam e um viajante nunca deveria passar mais tempo do que o necessário para chegar em seu destino, alguns dos anciãos declaravam que o lugar era amaldiçoado. Com um atraso de dois dias e um mochila de suprimentos quase esgotada uma decisão deveria ser tomada continuar caminhando ou parar na caverna que estava logo adiante e estabelecer acampamento para a noite.</p> \n</br><a class=\"squiffy-link link-section\" data-section=\"Estabelecer acampamento na caverna.\" role=\"link\" tabindex=\"0\">Estabelecer acampamento na caverna.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Continuar caminhando.\" role=\"link\" tabindex=\"0\">Continuar caminhando.</a></p>",
		'passages': {
		},
	},
	'Continuar caminhando.': {
		'clear': true,
		'text': "<p><p>Já fazia horas que você estava caminhando ou eram minutos com frio e olhos quase fechados era difícil de acompanhar o tempo. Seus movimentos pareciam diminuir cada vez mais de velocidade até que tudo ficou preto…</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'clear': true,
		'text': "<p><p>Você estava confortável deitado numa cama macia com cobertas quentes... num susto abriu os olhos sua última memória era estar na estrada.\n</br>- Calma, calma dorminhão - você ouviu uma voz falar.\nLevantando da cama viu um pequeno ser de menos de meio metro, com uma barba e cabelo longos e um chapéu vermelho pontudo na cabeça sem dúvida um gnomo perto da lareira.\n</br>- Onde estou? - Perguntou confuso.\n</br>- Você está na minha casa, a 3 dias atrás lhe encontrei duro como um pedra, e lhe arrastei até aqui a propósito deveria começar a pensar em uma dieta - respondeu o gnomo.\n</br>- 3 dias? Eu dormi por dias? Eu já devia ter chegado em RagFord! - Exclamou agitado.\n</br>- RagFord você disse, eu estou procurando alguém para fazer um serviço na cidade.\n</br>- Que tipo se serviço? - Você perguntou desconfiado.\n</br>- Oh nada muito sombrio só roubar alguns cogumelos na casa do cozinheiro da cidade, o bastardo realmente não gosta de dividir seus cogumelos. Então o que me diz está disposto a aceitar o serviço e ganhar umas moedas extras?\nVocê continuou o olhando com desconfiança e respondeu:</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Aceitar serviço.\" role=\"link\" tabindex=\"0\">Aceitar serviço.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Não aceitar serviço.\" role=\"link\" tabindex=\"0\">Não aceitar serviço.</a></p>",
		'passages': {
		},
	},
	'Não aceitar serviço.': {
		'clear': true,
		'text': "<p><p>-Tem certeza eu salvei a sua vida, pense nisso como um modo de retribuir - argumentou o gnomo.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Aceitar serviço.\" role=\"link\" tabindex=\"0\">Aceitar serviço.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Continuar não aceitando o serviço.\" role=\"link\" tabindex=\"0\">Continuar não aceitando o serviço.</a></p>",
		'passages': {
		},
	},
	'Continuar não aceitando o serviço.': {
		'clear': true,
		'text': "<p><p>O gnomo se mostra decepcionado com sua escolha, partindo de sua casa você volta para o caminho até RagFord algumas moedas extras seria bom mas você não estava disposto a ser pego roubando cogumelos.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Aceitar serviço.': {
		'clear': true,
		'text': "<p><p>Com os suplementos restabelecidos e um novo serviço você saiu da casa do gnomo pronto para voltar ao caminho e chegar o mais breve possível em RagFord.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'clear': true,
		'text': "<p><p>O resto da jornada até RagFord ocorreu sem problemas, chegando no meio do dia o cozinheiro provavelmente deveria estar trabalhando na pousada principal da cidade proporcionando o momento perfeito para o roubo. Se direcionando para a casa onde o furto deveria ocorrer você viu que havia duas maneiras de entrar nela.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Pular janela.\" role=\"link\" tabindex=\"0\">Pular janela.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Entrar pela porta do fundos.\" role=\"link\" tabindex=\"0\">Entrar pela porta do fundos.</a></p>",
		'passages': {
		},
	},
	'Pular janela.': {
		'clear': true,
		'text': "<p><p>Com uma janela do segundo andar aberta você escalou a parede da casa até chegar nela, a casa estava sem outras pessoas assim como havia sido planejado, mas qual seria o cômodo que o cozinheiro guardava os cogumelos. Indo no escritório só parecia ter livros de culinária mas nada valioso, na sala uma grande mesa e seis cadeiras mas novamente nada valioso, na cozinha uma torta em cima de um balcão, abrindo as portas do armário de ingredientes um pote de pimenta, temperos verdes, cogumelos super valiosos, farinha ... espera você achou cogumelos super valiosos. Agora só era necessário pegar e sair da casa do mesmo modo que você entrou. Mas a torta estava com uma cara tão deliciosa uma pedaço não faria mal.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Comer torta.\" role=\"link\" tabindex=\"0\">Comer torta.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Não comer torta.\" role=\"link\" tabindex=\"0\">Não comer torta.</a></p>",
		'passages': {
		},
	},
	'Não comer torta.': {
		'clear': true,
		'text': "<p><p>Sem comer a torta você saiu da casa, pronto para fazer a entrega ao gnomo dos cogumelos.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'clear': true,
		'text': "<p><p>Na casa do gnomo os cogumelos são entregues e em retorno você recebeu algumas moedas, só lhe restava retornar a RagFord e fazer bom uso delas a sua jornada tinha sido melhor do que esperado.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Comer torta.': {
		'clear': true,
		'text': "<p><p>Você pegou um pedaço de torta e começou a comer. Na quarta mordida o cozinheiro em um surto de fúria chegou em casa.\n</br>- Seu ladrão ordinário invadindo minha casa e ainda comendo minha torta!!! - Gritou ele.\nVocê ficou paralisado sem expressar nenhuma reação com a boca aberta e com torta nela também.\n</br>- São esses os meus cogumelos super valiosos em cima da mesa? Você deve trabalhar para aquele\ngnomo vigarista! Achou que você poderia ou pular a janela da minha casa e ninguém ia ver! - Continuou gritando.\nAh então foi assim que você foi descoberto.\n</br>- Os guardas já estão vindo lhe prender nem pense em se mover - ordenou.\nSó lhe restava esperar seu destino sentado…</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'clear': true,
		'text': "<p><p>Já na prisão você ponderou que talvez não devesse ter comido a torta.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Entrar pela porta do fundos.': {
		'clear': true,
		'text': "<p><p>Com um pouco de força a fechadura da porta dos fundos se abriu, a casa estava sem outras pessoas assim como havia sido planejado, mas qual seria o cômodo que o cozinheiro guardava os cogumelos. Indo no escritório só parecia ter livros de culinária mas nada valioso, na sala uma grande mesa e seis cadeiras mas novamente nada valioso, na cozinha uma torta em cima de um balcão, abrindo as portas do armário de ingredientes um pote de pimenta, temperos verdes, cogumelos super valiosos, farinha ... espera você achou cogumelos super valiosos. Agora só era necessário pegar e sair da casa do mesmo modo que você entrou. Mas a torta estava com uma cara tão deliciosa uma pedaço não faria mal.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Comer torta..\" role=\"link\" tabindex=\"0\">Comer torta..</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Não comer torta.\" role=\"link\" tabindex=\"0\">Não comer torta.</a></p>",
		'passages': {
		},
	},
	'Comer torta..': {
		'clear': true,
		'text': "<p><p>Saindo da casa depois de comer a torta e guardando os cogumelos em sua mochila, começou o caminho de volta até o gnome depois de alguns passos, começou a sentir um peso na barriga e uma dificuldade de manter os olhos aberto, ah de novo não, então tudo ficou preto...</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'clear': true,
		'text': "<p><p>Agora acordando em um hospital a primeira coisa que você fez foi checar sua mochila... diabos os cogumelos não estavam mais ali talvez você não devesse ter comido a torta. Enquanto as consequências não chegavam aproveitaria para usufruir mais algumas horas de sono tranquilo naquela cama aconchegante.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Estabelecer acampamento na caverna.': {
		'clear': true,
		'text': "<p><p>Com uma fogueira acesa aquecendo o interior da caverna ficando protegido do frio, você finalmente poderia dormir.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'clear': true,
		'text': "<p><p>Acordado em um susto, com sons de movimento que ecoavam na caverna apenas uma pensamento lhe passava pela mente você não estava sozinho ali. Com um fogo próximo de acabar a iluminação só lhe permitia ver uma silhueta sem muitos detalhes além de que a criatura que estava presente era pelo menos meio metro maior que você. Lentamente levantando para conseguir uma visão melhor, não restava dúvida o que estava em sua frente era um dragão de escamas azuis e olhos amarelos inquisidores. Sua próxima atitude deveria ser bem articulada.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Não se aproxime mais ou você vai se arrepender! - Falou agressivamente.\" role=\"link\" tabindex=\"0\">- Não se aproxime mais ou você vai se arrepender! - Falou agressivamente.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Olá ...  - Falou tentando manter a maior calma possível.\" role=\"link\" tabindex=\"0\">- Olá ...  - Falou tentando manter a maior calma possível.</a></p>",
		'passages': {
		},
	},
	'- Não se aproxime mais ou você vai se arrepender! - Falou agressivamente.': {
		'clear': true,
		'text': "<p><p>O dragão emitiu um rosnado, que fez você recuar e em um tom irônico e de desdém falou:\n</br> - Eu me arrepender? Olha seu tamanho humano quem realmente está em vantagem eu ou você.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'clear': true,
		'text': "<p><p>Você não podia acreditar em seus ouvidos não bastava ter encontrado um dragão pela primeira vez e ele também podia falar.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"- E precisava me acordar para provar toda essa vantagem? E agora é a hora que você me mata? Poderia ter feito isso enquanto eu dormia ainda. - Resmungou você irritado.\" role=\"link\" tabindex=\"0\">- E precisava me acordar para provar toda essa vantagem? E agora é a hora que você me mata? Poderia ter feito isso enquanto eu dormia ainda. - Resmungou você irritado.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Okay você fez seu argumento mas o que quer comigo? - Curioso você perguntou.\" role=\"link\" tabindex=\"0\">- Okay você fez seu argumento mas o que quer comigo? - Curioso você perguntou.</a></p>",
		'passages': {
		},
	},
	'- Olá ...  - Falou tentando manter a maior calma possível.': {
		'clear': true,
		'text': "<p><p>O dragão lhe passou os olhos analisando cada uma de suas feições físicas. Até em um momento de conclusão perguntar:\n</br>- O que você faz aqui humano? </p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'clear': true,
		'text': "<p><p>Você não podia acreditar em seus ouvidos não bastava ter encontrado um dragão pela primeira vez e ele também podia falar.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Eu estava descansando até você me acordar com tanta sutileza só falta querer me machucar agora. - Você exclamou indignado.\" role=\"link\" tabindex=\"0\">- Eu estava descansando até você me acordar com tanta sutileza só falta querer me machucar agora. - Você exclamou indignado.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Eu? Eu entrei nessa caverna para realizar uma pequena pausa na minha jornada mas em que posso lhe ajudar? - Você perguntou animado.\" role=\"link\" tabindex=\"0\">- Eu? Eu entrei nessa caverna para realizar uma pequena pausa na minha jornada mas em que posso lhe ajudar? - Você perguntou animado.</a></p>",
		'passages': {
		},
	},
	'- E precisava me acordar para provar toda essa vantagem? E agora é a hora que você me mata? Poderia ter feito isso enquanto eu dormia ainda. - Resmungou você irritado.': {
		'clear': true,
		'text': "<p><p>Fazendo questão de mostrar suas garras e dentes afiados o dragão exigiu:\n</br>- Você vai me ajudar a encontrar meu irmão mais velho ele já devia ter retornado a essa caverna a 2 dias atrás mas ainda não recebi nenhuma notícia sua!</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'clear': true,
		'text': "<p><p>Encontrar alguém de floresta de Orswick não seria uma tarefa fácil, se ao menos você tivesse escolha mas parecia que por enquanto nada poderia ser feito sobre isso, um ponto de referência já seria bom, ah mas claro.\n</br>- Cof Cof Ei sua majestade dragão qual foi o último lugar que seu irmão deveria ir antes de retornar aqui?\n</br>- Mew - respondeu ele brevemente.\n</br>- Mew!? Mas Mew é uma das partes mais perigosas da floresta, e você quer que eu vá lá? - Exclamou quase gritando.\n</br>- Sim - respondeu novamente brevemente.\n</br>Notando que não conseguiria mais respostas dele e aceitando seu destino, resolveu sair da caverna e finalmente começar a busca. </p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue10': {
		'clear': true,
		'text': "<p><p>Após algumas horas de caminhada e a presença constante do silêncio, vocês haviam chegada em Lee talvez a parte da floresta antes de Mew mais tranquila, a região era conhecida por ser a casa de furões. Furões por todo lado, furões em árvores, furões no chão, furões correndo, furões andando... uma grande sociedade de furões. Eles observavam a presença dos dois estranhos com curiosidade, quão raro era ver um dragão e um humano juntos.\n</br>- Aileen!! - chamou o dragão lhe causando um susto.\nMas quem era Aileen? De repente um furão fêmea branco apareceu correndo em sua direção o dragão e ela pareciam velhos conhecidos e logo começaram uma conversa que você não entendia. Após alguns minutos Aileen partiu e o dragão lhe dirigiu a palavra:\n</br>- Aileen me informou que meu irmão passou por aqui a 3 dias atrás e que temos dois atalhos para chegar em Mew, por uma ponte instável ou por um pântano abandonado.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por pântano...\" role=\"link\" tabindex=\"0\">Seguir por pântano...</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por ponte...\" role=\"link\" tabindex=\"0\">Seguir por ponte...</a></p>",
		'passages': {
		},
	},
	'- Okay você fez seu argumento mas o que quer comigo? - Curioso você perguntou.': {
		'clear': true,
		'text': "<p><p>- É você vai servir - disse o dragão seguido de um suspiro - meu irmão mais velho deveria ter voltado a 2 dias. - Ele fez uma pausa. - Você estaria disposto a me ajudar encontrar ele? - Completou com repulsão.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Ajudar.\" role=\"link\" tabindex=\"0\">Ajudar.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Não ajudar.\" role=\"link\" tabindex=\"0\">Não ajudar.</a></p>",
		'passages': {
		},
	},
	'- Eu estava descansando até você me acordar com tanta sutileza só falta querer me machucar agora. - Você exclamou indignado.': {
		'clear': true,
		'text': "<p><p>Fazendo questão de mostrar suas garras e dentes afiados o dragão exigiu:\n</br>- Você vai me ajudar a encontrar meu irmão mais velho ele já devia ter retornado a essa caverna a 2 dias atrás mas ainda não recebi nenhuma notícia sua!</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'clear': true,
		'text': "<p><p>Encontrar alguém de floresta de Orswick não seria uma tarefa fácil, se ao menos você tivesse escolha mas parecia que por enquanto nada poderia ser feito sobre isso, um ponto de referência já seria bom, ah mas claro.\n</br>- Cof Cof Ei sua majestade dragão qual foi o último lugar que seu irmão deveria ir antes de retornar aqui?\n</br>- Mew - respondeu ele brevemente.\n</br>- Mew!? Mas Mew é uma das partes mais perigosas da floresta, e você quer que eu vá lá? - Exclamou quase gritando.\n</br>- Sim - respondeu novamente brevemente.\n</br>Notando que não conseguiria mais respostas dele e aceitando seu destino, resolveu sair da caverna e finalmente começar a busca. </p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'clear': true,
		'text': "<p><p>Após algumas horas de caminhada e a presença constante do silêncio, vocês haviam chegada em Lee talvez a parte da floresta antes de Mew mais tranquila, a região era conhecida por ser a casa de furões. Furões por todo lado, furões em árvores, furões no chão, furões correndo, furões andando... uma grande sociedade de furões. Eles observavam a presença dos dois estranhos com curiosidade, quão raro era ver um dragão e um humano juntos.\n</br>- Aileen!! - chamou o dragão lhe causando um susto.\nMas quem era Aileen? De repente um furão fêmea branco apareceu correndo em sua direção o dragão e ela pareciam velhos conhecidos e logo começaram uma conversa que você não entendia. Após alguns minutos Aileen partiu e o dragão lhe dirigiu a palavra:\n</br>- Aileen me informou que meu irmão passou por aqui a 3 dias atrás e que temos dois atalhos para chegar em Mew, por uma ponte instável ou por um pântano abandonado.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por pântano...\" role=\"link\" tabindex=\"0\">Seguir por pântano...</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por ponte...\" role=\"link\" tabindex=\"0\">Seguir por ponte...</a></p>",
		'passages': {
		},
	},
	'- Eu? Eu entrei nessa caverna para realizar uma pequena pausa na minha jornada mas em que posso lhe ajudar? - Você perguntou animado.': {
		'clear': true,
		'text': "<p><p>- É você vai servir - disse o dragão seguido de um suspiro - meu irmão mais velho deveria ter voltado a 2 dias. - Ele fez uma pausa. - Você estaria disposto a me ajudar encontrar ele? - Completou com repulsão.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Ajudar.\" role=\"link\" tabindex=\"0\">Ajudar.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Não ajudar.\" role=\"link\" tabindex=\"0\">Não ajudar.</a></p>",
		'passages': {
		},
	},
	'Ajudar.': {
		'clear': true,
		'text': "<p><p>Encontrar alguém de floresta de Orswick não seria uma tarefa fácil, se ao menos vocês tivessem algum ponto de referência, ah mas claro.\n</br>- Cof Cof Ei dragão qual foi o último lugar que seu irmão deveria ir antes de retornar aqui?\n</br>- Mew - respondeu ele brevemente.\n</br>- Mew!? Mas Mew é uma das partes mais perigosas da floresta, o que ele estava fazendo lá?\n</br>- Pesquisa - respondeu novamente brevemente.\n</br>Notando que não conseguiria mais respostas dele, resolveu sair da caverna e finalmente começar a busca.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'clear': true,
		'text': "<p><p>Após algumas horas de caminhada e a presença constante do silêncio, vocês haviam chegada em Lee talvez a parte da floresta antes de Mew mais tranquila, a região era conhecida por ser a casa de furões. Furões por todo lado, furões em árvores, furões no chão, furões correndo, furões andando... uma grande sociedade de furões. Eles observavam a presença dos dois estranhos com curiosidade, quão raro era ver um dragão e um humano juntos.\n</br>- Aileen!! - chamou o dragão lhe causando um susto.\nMas quem era Aileen? De repente um furão fêmea branco apareceu correndo em sua direção o dragão e ela pareciam velhos conhecidos e logo começaram uma conversa que você não entendia. Após alguns minutos Aileen partiu e o dragão lhe dirigiu a palavra:\n</br>- Aileen me informou que meu irmão passou por aqui a 3 dias atrás e que temos dois atalhos para chegar em Mew, por uma ponte instável ou por um pântano abandonado.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por pântano.\" role=\"link\" tabindex=\"0\">Seguir por pântano.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Seguir por ponte.\" role=\"link\" tabindex=\"0\">Seguir por ponte.</a></p>",
		'passages': {
		},
	},
	'Não ajudar.': {
		'clear': true,
		'text': "<p><p>Por mais que o dragão parecesse desesperado você tinha sua própria jornada que já estava atrasada para terminar.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue14': {
		'clear': true,
		'text': "<p><p>Sem mais surpresas você chegou a RagFord mas teria uma história para o resto da vida o encontro com um dragão que fala.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Seguir por pântano.': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava o pântano, o lugar realmente parecia abandonado sem nenhuma vida, com passos lentos e cautelosos iam avançando suas botas logo se encontram molhadas. Um barulho soou na água e uma criatura começou a engrandecer, era um monstro do pântano com raízes cobrindo seu corpo e parecendo pronto para golpear alguém. </p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Sacar a espada que estava na sua cintura.\" role=\"link\" tabindex=\"0\">Sacar a espada que estava na sua cintura.</a>:\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Você entra em pânico.\" role=\"link\" tabindex=\"0\">Você entra em pânico.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Pedir para que o dragão faça alguma coisa para proteger vocês.\" role=\"link\" tabindex=\"0\">Pedir para que o dragão faça alguma coisa para proteger vocês.</a></p>",
		'passages': {
		},
	},
	'Seguir por ponte.': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava um ponte de madeira, o lugar parecia pronto para desabar a qualquer momento porém felizmente ela larga o suficiente para alguém com o porte do dragão passar. Antes de começar a travessia vocês deviam decidir quem iria primeiro.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Você.\" role=\"link\" tabindex=\"0\">Você.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Dragão.\" role=\"link\" tabindex=\"0\">Dragão.</a></p>",
		'passages': {
		},
	},
	'Seguir por pântano...': {
		'clear': true,
		'text': "<p><p>Depois de decidir que vocês devem seguir pelo pântano, o dragão anuncia que vocês na verdade vão pela ponte afinal ele está no comando e você não é confiável.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que o pântano é a melhor escolha.\" role=\"link\" tabindex=\"0\">Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que o pântano é a melhor escolha.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores.\" role=\"link\" tabindex=\"0\">Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores.</a></p>",
		'passages': {
		},
	},
	'Seguir por ponte...': {
		'clear': true,
		'text': "<p><p>Depois de decidir que vocês devem seguir pela ponte, o dragão anuncia que vocês na verdade vão pelo pântano afinal ele está no comando e você não é confiável.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que a ponte é a melhor escolha.\" role=\"link\" tabindex=\"0\">Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que a ponte é a melhor escolha.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores!\" role=\"link\" tabindex=\"0\">Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores!</a></p>",
		'passages': {
		},
	},
	'Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que o pântano é a melhor escolha.': {
		'clear': true,
		'text': "<p><p>Seguem pelo pântano.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava o pântano, o lugar realmente parecia abandonado sem nenhuma vida, com passos lentos e cautelosos iam avançando suas botas logo se encontram molhadas. Um barulho soou na água e uma criatura começou a engrandecer, era um monstro do pântano com raízes cobrindo seu corpo e parecendo pronto para golpear alguém. </p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Pedir para que o dragão faça alguma coisa para proteger vocês.\" role=\"link\" tabindex=\"0\">Pedir para que o dragão faça alguma coisa para proteger vocês.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Sacar a espada que estava na sua cintura.\" role=\"link\" tabindex=\"0\">Sacar a espada que estava na sua cintura.</a></p>",
		'passages': {
		},
	},
	'Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores.': {
		'clear': true,
		'text': "<p><p>Seguem pela ponte.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava um ponte de madeira, o lugar parecia pronto para desabar a qualquer momento porém felizmente ela larga o suficiente para alguém com o porte do dragão passar. Antes de começar a travessia o dragão decidi que ele vai primeiro</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'clear': true,
		'text': "<p><p>Com passos cuidados o dragão começou a travessia, quando estava na metade da ponte os desmoronamento começaram a acontecer. O dragão gritou para você se apressar.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Correr para o lado contrário do dragão.\" role=\"link\" tabindex=\"0\">Correr para o lado contrário do dragão.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Começar a travessia apressadamente.\" role=\"link\" tabindex=\"0\">Começar a travessia apressadamente.</a></p>",
		'passages': {
		},
	},
	'Pedir para que o dragão faça alguma coisa para proteger vocês.': {
		'clear': true,
		'text': "<p><p>Para derrotar o monstro vocês precisam trabalhar em equipe, o dragão lhe dá a missão de distrair o inimigo para que no momento certo ele possa acertar um ataque fatal. Sua tática é gritar:</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Hey seu bicho feioso suas raízes estão podres!\" role=\"link\" tabindex=\"0\">- Hey seu bicho feioso suas raízes estão podres!</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"- Hey seu bicho fedorento todo esse tempo na água e ainda cheirando mal!\" role=\"link\" tabindex=\"0\">- Hey seu bicho fedorento todo esse tempo na água e ainda cheirando mal!</a></p>",
		'passages': {
		},
	},
	'- Hey seu bicho fedorento todo esse tempo na água e ainda cheirando mal!': {
		'clear': true,
		'text': "<p><p>A atenção do monstro estava focada em você e ele começava a se movimentar em sua direção soltando grunhidos, enquanto isso o dragão se posicionava em um ângulo perfeito para dar o bote. Quando ele estava a um metro de lhe atingir o dragão usou seu rabo para o derrubar insciente, o que gerou uma oportunidade de fuga ideal. Sem perder tempo e animados pela vitória saíram em disparada do local sem olhar para trás e só foram parar quando encontraram flores brancas no chão sinal típico da região Mew. Depois dessa situação de perigo juntos você resolveu que deveria saber pelo menos uma informação.\n</br>- Sinto que já passamos da zona onde preciso ficar só lhe chamando de dragão, então qual o seu nome?\n</br>- Meu nome é Saff, e agora que estamos ligados vai me dizer a razão de não ter usado essa espada na sua cintura lá trás?\nVocê olha para a sua cintura já havia até esquecido que ela estava lá, a espada um presente da sua mãe antes de sair de casa era uma relíquia da sua família.\n</br>- A verdade é que não sei como usa-la - falou em um tom baixo envergonhado e saiu andando ouvindo ao fundo a risada de Saff.</p>",
		'passages': {
		},
	},
	'- Hey seu bicho feioso suas raízes estão podres!': {
		'clear': true,
		'text': "<p><p>A atenção do monstro estava focada em você e ele começava a se movimentar em sua direção soltando grunhidos, enquanto isso o dragão se posicionava em um ângulo perfeito para dar o bote. Quando ele estava a um metro de lhe atingir o dragão usou seu rabo para o derrubar insciente, o que gerou uma oportunidade de fuga ideal. Sem perder tempo e animados pela vitória saíram em disparada do local sem olhar para trás e só foram parar quando encontraram flores brancas no chão sinal típico da região Mew. Depois dessa situação de perigo juntos você resolveu que deveria saber pelo menos uma informação.\n</br>- Sinto que já passamos da zona onde preciso ficar só lhe chamando de dragão, então qual o seu nome?\n</br>- Meu nome é Saff, e agora que estamos ligados vai me dizer a razão de não ter usado essa espada na sua cintura lá trás?\nVocê olha para a sua cintura já havia até esquecido que ela estava lá, a espada um presente da sua mãe antes de sair de casa era uma relíquia da sua família.\n</br>- A verdade é que não sei como usa-la - falou em um tom baixo envergonhado e saiu andando ouvindo ao fundo a risada de Saff.</p>",
		'passages': {
		},
	},
	'Sacar a espada que estava na sua cintura.': {
		'clear': true,
		'text': "<p><p>Único problema é que você não sabe como usa-la, ela havia sido um presente antes de sair de casa de sua mãe uma relíquia da família.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue18': {
		'clear': true,
		'text': "<p><p>Com o monstro se aproximando desajeitado e sem nenhuma habilidade você preparou um ataque, levantou a espada, fechou os olhos e tentou acertar o golpe. Quando abriu os olhos a criatura estava no chão e sentiu uma imensa dor no braço parece que vitória tinha seus custos o machucado ali provavelmente deixaria uma cicatriz.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue19': {
		'clear': true,
		'text': "<p><p>Olhou para o lado e o dragão que estava balançado a cabeça em negação, não impressionado você falou:\n</br>- Pelo menos eu fiz algo enquanto você desse tamanho ficou parado, eu chegaria a dizer que salvei sua vida e esse machucado é prova.\nO dragão riu e respondeu:\n</br>- Salvou?? - E soltou uma gargalhada ainda maior. - Esse machucado só prova a sua falta de habilidade.\nOs dois continuaram a andar no caminho mas sem parar de discutir, até notarem flores brancas no chão típicas da região de Mew. Eles estavam perto de atingir seu destino mas antes você precisava saber uma informação.\n</br>- Já que vamos entrar em uma região perigosa acho que já passamos pelo suficiente para você pelo menos me dizer seu nome.\n</br>- Você precisar ser mais paciente - respondeu o dragão enigmático e segui em frente.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'clear': true,
		'text': "<p>Orswick era um lugar sombrio, com árvores antigas e onde muitos se aventuravam em busca\nde itens preciosos sem nunca retornar. Por prevensão você começou andar mais perto do dragão.\n</br>- Meu irmão supostamente deveria estar ao norte - comentou o dragão.\nEntão em direção ao norte vocês foram. Quanto mais ao norte andavam mais um som assustador de dor ouviam, alguma\ncriatura estava em um imenso sofrimento. Conforme o som ficava mais claro mais o dragão ficava agitado.\n</br>- Esse som... - disse ele - eu conheço essa voz... é meu irmão - constatou e saiu em disparada.\n</br>Você saiu em seu encalço, quando ele parou conseguiu ver uma cena que ficaria sempre em sua memória um dragão\nenorme preso em um armadilha mortal.\n</br>- Irmão ... - ele sussurrou quase perdendo a consciência.\n</br>- Como podemos tirar ele disso? - Você pediu com tom de desespero.\n</br>- Existe uma alavanca que apenas mãos humanas conseguem manipular, eu sei que nós nem sempre nos entendemos mas por favor... - suplicou.\n</br>Acatando seu pedido você foi até a alavanca e desarmou a armadilha. Assim que desarmada o dragão maior abriu suas asas o derrubando com a força do vento e soltando um grito de dor. Depois de levantar do chão você foi em direção aos irmãos que agora celebravam seu reencontro.\n</br>- Olá humano, obrigado por me salvar - disse o dragão maior.\n</br>Você apenas assentiu com a cabeça.\n</br>- Desculpe irmão não consegui encontrar a cura para suas asas - falou novamente o dragão maior.\n</br>- Cura?? - Você perguntou.\n</br>- Meu irmão menor possui um problema em suas asas eu esperava que as propriedades mágicas da água santa pudesse curá-lo, mas a lenda da água santa que supostamente deveria curar qualquer ferimento não passava de um lenda contada para atrair vítimas que a buscavam.\n</br>- Então era por isso que você não podia voar até aqui ... - constatou você ao dragão menor que desviou o olhar embaraçado.\n</br>- Acho que ficamos tempo demais em Orswick, vamos voltar para Mew - falou o dragão maior.</p>",
		'passages': {
		},
	},
	'Tentando ser compreensivo  afinal o irmão dele está desaparecido você argumenta que realmente acredita que a ponte é a melhor escolha.': {
		'clear': true,
		'text': "<p><p>Seguem pela ponte.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava um ponte de madeira, o lugar parecia pronto para desabar a qualquer momento porém felizmente ela larga o suficiente para alguém com o porte do dragão passar. Antes de começar a travessia vocês deviam decidir quem iria primeiro.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Você.\" role=\"link\" tabindex=\"0\">Você.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Dragão..\" role=\"link\" tabindex=\"0\">Dragão..</a></p>",
		'passages': {
		},
	},
	'Você não acredita nas palavras que saem da boca dele. Ele só está no comando porque tem garras maiores!': {
		'clear': true,
		'text': "<p><p>Seguem pelo pântano.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue22': {
		'clear': true,
		'text': "<p><p>Curioso você questionou porque o dragão não está voando, ele respondeu desinteressado que tem seus motivos. Logo a frente estava o pântano, o lugar realmente parecia abandonado sem nenhuma vida, com passos lentos e cautelosos iam avançando suas botas logo se encontram molhadas. Um barulho soou na água e uma criatura começou a engrandecer, era um monstro do pântano com raízes cobrindo seu corpo e parecendo pronto para golpear alguém. </p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Gritar para o dragão fazer alguma coisa.\" role=\"link\" tabindex=\"0\">Gritar para o dragão fazer alguma coisa.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Sacar a espada que estava na sua cintura.\" role=\"link\" tabindex=\"0\">Sacar a espada que estava na sua cintura.</a></p>",
		'passages': {
		},
	},
	'Gritar para o dragão fazer alguma coisa.': {
		'clear': true,
		'text': "<p><p>Mas quando olha para o lado ela já está mais lá saiu em disparada correndo.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\" Com raiva sacar a espada que estava na sua cintura.\" role=\"link\" tabindex=\"0\"> Com raiva sacar a espada que estava na sua cintura.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Sair correndo também.\" role=\"link\" tabindex=\"0\">Sair correndo também.</a></p>",
		'passages': {
		},
	},
	'Com raiva sacar a espada que estava na sua cintura.': {
		'clear': true,
		'text': "<p><p>Único problema é que você não sabe como usa-la, ela havia sido um presente antes de sair de casa de sua mãe uma relíquia da família.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue23': {
		'clear': true,
		'text': "<p><p>Com o monstro se aproximando desajeitado e sem nenhuma habilidade você preparou um ataque, levantou a espada, fechou os olhos e tentou acertar o golpe. Quando abriu os olhos a criatura estava no chão e sentiu uma imensa dor no braço parece que vitória tinha seus custos o machucado ali provavelmente deixaria uma cicatriz. Essa pode ser sua chance de escapar.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Sair correndo na direção contrária que o dragão foi.\" role=\"link\" tabindex=\"0\">Sair correndo na direção contrária que o dragão foi.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Gritar para o dragão esperar.\" role=\"link\" tabindex=\"0\">Gritar para o dragão esperar.</a></p>",
		'passages': {
		},
	},
	'Sair correndo na direção contrária que o dragão foi.': {
		'clear': true,
		'text': "<p><p>Você viu uma chance de fuga do dragão ranzinza e a aproveitou agora finalmente podia retornar para própria jornada.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue24': {
		'clear': true,
		'text': "<p><p>Sem mais surpresas você chegou a RagFord mas teria uma história para o resto da vida o encontro com um dragão que fala.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Gritar para o dragão esperar.': {
		'clear': true,
		'text': "<p>Você saiu correndo atrás do dragão e quando o alcança olhou para o chão  e notou flores brancas típicas da região de Mew, vocês haviam chegado ao seu destino, ofegante falou:\n</br>- Muito obrigado, pela ajuda lá trás ótimo trabalho! Você tem um nome ou posso começar a lhe chamar de covarde agora em diante.\nO dragão ignorou a reclamação e a pergunta e seguiu em frente.</p>",
		'passages': {
		},
	},
	'Sair correndo também.': {
		'clear': true,
		'text': "<p>Com muito esforço você alcançou o dragão e quando olhou para o chão notou flores brancas típicas da região de Mew, vocês haviam chegado ao seu destino, ofegante falou:\n</br>- Muito obrigado, por me abandonar lá trás! Você tem um nome ou posso começar a lhe chamar de covarde agora em diante.\nO dragão ignorou a reclamação e a pergunta e seguiu em frente.</p>",
		'passages': {
		},
	},
	'Você entra em pânico.': {
		'clear': true,
		'text': "<p><p>O monstro começou a vir em sua direção mas você estava paralisado. O dragão para poder lhe defender se jogou na sua frente nocauteando a criatura mas se machucando no processo.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'clear': true,
		'text': "<p>Seguindo em frente lentamente com o novo ferimento do dragão e seu peso na consciência de culpa, notaram que chegaram em um ponto com flores brancas no chão caracteristica tipica da região de Mew. Mas antes de continuar você precisava se desculpar.\n</br>- Você pode me dizer seu nome dragão para que eu posso me desculpar apropriadamente?\n</br>- Meu nome é Saff.\n</br>- Bom Saff me desculpe que você teve que se machucar por eu ter entrado em pânico - falou com voz de choro.\nO dragão sorriu e respondeu.\n</br>- Não se preocupe eu lhe salvei por livre espontânea vontade afinal você está me ajudando. \n</br>Com o ar limpo entre os dois eles estavam prontos para prosseguir.</p>",
		'passages': {
		},
	},
	'Você.': {
		'clear': true,
		'text': "<p><p>Com passos cuidados você foi na frente, quando estava na metade da ponte o dragão começou a seguir o caminho também, após alguns minutos os primeiros sinais de desmoronamento começaram a aparecer. O dragão gritou para você ficar calmo.</p>\n</br><a class=\"squiffy-link link-section\" data-section=\"Com medo você saiu correndo.\" role=\"link\" tabindex=\"0\">Com medo você saiu correndo.</a>\n</br>\n</br><a class=\"squiffy-link link-section\" data-section=\"Manteve a calma e continuou no mesmo ritmo.\" role=\"link\" tabindex=\"0\">Manteve a calma e continuou no mesmo ritmo.</a></p>",
		'passages': {
		},
	},
	'Dragão.': {
		'clear': true,
		'text': "<p><p>Com passos cuidados o dragão foi na frente, quando estava na metade da ponte você começou a seguir o caminho também, após alguns minutos os primeiros sinais de desmoronamento começaram a aparecer. O dragão gritou para você ficar calmo.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue26': {
		'clear': true,
		'text': "<p><p>Você manteve a calma e continuou no mesmo ritmo.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue27\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue27': {
		'clear': true,
		'text': "<p>Apesar dos desmoronamentos vocês conseguiram fazer a travessia sem mais problemas. Já do outro lado compartilharam um sorriso e quando olharam para baixo observaram flores brancas típicas da região de Mew.\n</br>- Nós conseguimos dragão! - Exclamou você animado.\n</br>- Saff, meu nome é Saff - respondeu o dragão seguido de mais um sorisso.</p>",
		'passages': {
		},
	},
	'Com medo você saiu correndo.': {
		'clear': true,
		'text': "<p>A ponte começou a desmontar mais rapidamente obrigando o  dragão a também acelerar os passo e por consequência no processo  se machucando. Após a travessia ele exclamou enfurecido.\n</br>- Eu não falei para você ficar calmo.\n</br>- Me desculpa eu entrei em pânico - você lamentou.\nA resposta causou que ele soltasse um rosnado. Quando olhou para o chão notou flores brancas típicas da região de Mew, ao menos vocês estavam mais perto do objetivo final.</p>",
		'passages': {
		},
	},
	'Manteve a calma e continuou no mesmo ritmo.': {
		'clear': true,
		'text': "<p>Apesar dos desmoronamentos vocês conseguiram fazer a travessia sem mais problemas. Já do outro lado compartilharam um sorriso e quando olharam para baixo observaram flores brancas típicas da região de Mew.\n</br>- Nós conseguimos dragão! - Exclamou você animado.\n</br>- Saff, meu nome é Saff - respondeu o dragão seguido de mais um sorisso.</p>",
		'passages': {
		},
	},
	'Correr para o lado contrário do dragão.': {
		'clear': true,
		'text': "<p><p>Quando você olhou para trás a ponte havia desabado sem chances do dragão lhe seguir em sua fuga finalmente retornando a sua própria jornada.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue28\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue28': {
		'clear': true,
		'text': "<p><p>Sem mais surpresas você chegou a RagFord mas teria uma história para o resto da vida o encontro com um dragão que fala.</p>\n</br>Fim.</p>",
		'passages': {
		},
	},
	'Começar a travessia apressadamente.': {
		'clear': true,
		'text': "<p>A ponte começou a desmontar mais rapidamente e por consequência no processo você acabou se machucando. Após a travessia o dragão exclamou com desdém.\n</p>- Se tivesse se apressado mais não teria se machucado.\n</p>- Me desculpa se a ponte não conseguiu segurar todo seu peso e eu tive que pagar o preço.\nA resposta causou que ele soltasse um rosnado.\nQuando olhou para o chão notou flores brancas típicas da região de Mew, ao menos vocês estavam mais perto do objetivo final.</p>",
		'passages': {
		},
	},
	'Dragão..': {
		'clear': true,
		'text': "<p><p>Com passos cuidados o dragão foi na frente, quando estava na metade da ponte você começou a seguir o caminho também, após alguns minutos os primeiros sinais de desmoronamento começaram a aparecer. O dragão gritou para você ficar calmo.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue29\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue29': {
		'clear': true,
		'text': "<p><p>Você não consegue manter a calma.</p>\n<a class=\"squiffy-link link-section\" data-section=\"_continue30\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue30': {
		'clear': true,
		'text': "<p>A ponte começou a desmontar mais rapidamente obrigando o dragão a também acelerar os passo e por consequência no processo você se machucando. Após a travessia ela exclamou enfurecido.\n</br>- Eu não falei para você ficar calmo.\n</br>- Me desculpa eu entrei em pânico - você lamentou.\nA resposta causou que ele soltasse um rosnado.\nQuando olhou para o chão notou flores brancas típicas da região de Mew, ao menos vocês estavam mais perto do objetivo final.</p>",
		'passages': {
		},
	},
}
})();
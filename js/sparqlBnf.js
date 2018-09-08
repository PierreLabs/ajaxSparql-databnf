/*jshint esversion: 6 */
$(function() {

    var svg = d3.select("svg"),
        width = $("#lesvg").width(), //+svg.attr("width"),
        height = $("#lesvg").height(); //+svg.attr("height");

    svg.append("g")
        .attr("transform", "translate(" + (width) / 2 + ",200)")
        .append("text").transition()
        .style("font-size", "22px")
        .style("font-family", "Arial")
        .style("fill", "#6633cc")
        .attr("text-anchor", "middle")
        .text("Renseigner un URI ci-dessous puis cliquer sur envoyer.");

    var gLinks,
        gNodes,
        simulation,
        lesManifs,
        oeuvreEnCours,
        coulOeuvreEnCours;


    var nodes = []; //Les noeuds
    var links = []; //Les arcs
    var dataObj = {}; //Objet des tableaux noeuds/liens


    var tabcouleurs = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#d58fd5", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#6873c6", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
    var color = d3.scaleOrdinal(tabcouleurs); //d3.schemeCategory10
    // var colorManifs = d3.scaleOrdinal(d3.schemePastel2);

    $('#btn').click(function() {
        $("#dOeuvres").html("");
        $(".card").css('opacity', '0');
        $("#rowErr").css("opacity", "0");
        nodes = []; //Les noeuds
        links = []; //Les arcs
        dataObj = {}; //Objet des tableaux noeuds/liens
        d3.selectAll("svg > *").remove();
        gLinks = svg.append("g");
        gNodes = svg.append("g");
        simulation = d3.forceSimulation()
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(2))
            .force("charge", d3.forceManyBody().strength(-350)) //.strength(-500)
            .force("link", d3.forceLink().id(function(d) {
                return d.uri;
            }).distance(function(d) {
                //longueur du lien : plus important si lien créateur
                return d.value === "Creator" ? 30 : 0.2;
            }).strength(2));

        var uri = $('#uri').val();
        sparqlData(uri);
    });
    $('#uri').keydown(function(e) { //Appuie sur entrée => click
        if (e.keyCode == 13) {
            $('#btn').click();
        }
    });

    //Zoom
    var zoom = d3.zoom()
        .scaleExtent([0.8 / 2, 4])
        .on("zoom", zoomed);

    svg.call(zoom);

    function zoomed() {
        gLinks.attr("transform", d3.event.transform);
        gNodes.attr("transform", d3.event.transform);
    }



    function sparqlData(uri) {
        //http://data.bnf.fr/ark:/12148/cb11907966z Hugo
        //http://data.bnf.fr/ark:/12148/cb14793455w Giuliani
        //http://data.bnf.fr/ark:/12148/cb118900414 Balzac

        //point de terminaison
        var endpoint = "http://data.bnf.fr/sparql";
        //Préfixes
        //note: <http://rdvocab.info/ElementsGr2/> est obsolète (FRAD) mais toujours utilisé dans le modèle de données de data.bnf.fr
        var prefixes = "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX frad: <http://rdvocab.info/ElementsGr2/>";
        //Requête SPARQL
        var req = "SELECT DISTINCT ?oeuvre ?titre ?nom ?resum (SAMPLE(?depic) as ?fdepic) (SAMPLE(?wDepic) as ?wdepic) WHERE {<" + uri + "> foaf:focus ?person; skos:prefLabel ?nom . ?oeuvre dcterms:creator ?person; rdfs:label ?titre . OPTIONAL { ?oeuvre foaf:depiction ?wDepic. } OPTIONAL { ?person frad:biographicalInformation ?resum.} OPTIONAL { ?person foaf:depiction ?depic. }} ORDER BY RAND() LIMIT 100";

        //fetch databnf sparql
        var url = new URL(endpoint),
            params = { queryLn: 'SPARQL', output: 'json', query: prefixes + req, limit: 'none', infer: 'true', Accept: 'application/sparql-results+json' };
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        //Envoi de la requête (asynchrone avec promesse)
        fetch(url)
            .then(reponse => reponse.json())
            .then(data => traitOeuvres(uri, data))
            .catch(err => console.log(err));
    }

    function traitOeuvres(uri, oeuvres) {

        if ((oeuvres.results.bindings.length)) { //S'il y a des résultats
            $("#rowErr").remove();
            $.each(oeuvres.results.bindings, function(i, oeuvre) {
                if (i === 0) {
                    //depiction auteur + abstract
                    $("#depic").attr('src', typeof oeuvre.fdepic !== "undefined" ? oeuvre.fdepic.value : "#");
                    $(".card-title").html(oeuvre.nom.value);
                    $(".card-text").html(oeuvre.resum.value);
                    $(".card").css('opacity', '1');

                    //nodes index 0 = auteur
                    nodes.push({ titre: oeuvre.nom.value, depic: typeof oeuvre.fdepic !== "undefined" ? oeuvre.fdepic.value : "#", uri: uri, group: "auteur" });
                    nodes.push({ titre: oeuvre.titre.value, depic: typeof oeuvre.wdepic !== "undefined" ? oeuvre.wdepic.value : "/img/oeuvre.png", uri: oeuvre.oeuvre.value, dateEd: "", group: "oeuvre" });
                } else {
                    nodes.push({ titre: oeuvre.titre.value, depic: typeof oeuvre.wdepic !== "undefined" ? oeuvre.wdepic.value : "/img/oeuvre.png", uri: oeuvre.oeuvre.value, dateEd: "", group: "oeuvre" });
                }
                links.push({ source: uri, target: oeuvre.oeuvre.value, value: "Creator" });
            });
            // var newnodes = supprDoublons(nodes, "id"); //Tableau des noeuds uniques
            dataObj = {
                nodes: nodes,
                links: links
            };


            //Ajout de "cards bootstrap" pour une visualisation sous forme de liste plus traditionnelle
            $.each(dataObj.nodes, function(i, e) { // Itération sur les noeuds
                if (i > 0) { //Si pas l'auteur
                    $("#dOeuvres").append("<div class='card card-oeuvre d-inline-block text-white' data-uri='" + e.uri + "' style='max-width:225px; background-color: " + color(e.titre) + ";'><img class='card-img-top img-rounded' src='" + e.depic + "' alt='illustration oeuvre'><div class='card-body'><h5 class='card-title'>" + e.titre + "</h5><p class='card-text'>Une oeuvre de " + dataObj.nodes[0].titre + "</p><a href='" + e.uri + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Accéder à la ressource</a></div></div>");
                } else if (i === 0) { //Si auteur
                    $("#cardAuteur").css("background-color", color(e.titre));
                }
            });
            $(".card-oeuvre").wrapAll("<div class='card-columns d-inline-block'></div>");

            d3.selectAll('.card-oeuvre').on("click", function() {
                var luri = this.dataset.uri;
                var leNode = d3.selectAll('circle').filter(function(n) {
                    return n.uri === luri;
                });
                $('html, body').animate({ scrollTop: 0 }, 200);
                setTimeout(function() {
                    leNode.dispatch('click');
                }, 300);
            });

            renduGraph(0);

        } else { //S'il n'y a pas de résultats
            $("#btn").after("<div id='rowErr' class='alert alert-danger col-6 top-marge' role='alert'>Aucun résultat...</div>");
            $("#rowErr").css("opacity", "1");
        }
    }

    function reqManifs(uri) {
        //point de terminaison
        var endpoint = "http://data.bnf.fr/sparql";
        p = "PREFIX rdarelationships: <http://rdvocab.info/RDARelationshipsWEMI/> PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>";
        //Requête SPARQL
        r = "SELECT DISTINCT ?manif ?titre ?isJeune ?desc ?pub ?note ?repro WHERE{ ?manif rdarelationships:workManifested <" + uri + ">; dcterms:title ?titre; dcterms:description ?desc; dcterms:publisher ?pub; <http://rdvocab.info/Elements/note> ?note. OPTIONAL{ ?manif bnf-onto:ouvrageJeunesse ?isJeune.} OPTIONAL{ ?manif <http://rdvocab.info/RDARelationshipsWEMI/electronicReproduction> ?repro.} }";

        //fetch databnf sparql
        var url = new URL(endpoint),
            params = { queryLn: 'SPARQL', output: 'json', query: p + r, limit: 'none', infer: 'true', Accept: 'application/sparql-results+json' };
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        //Envoi de la requête (asynchrone avec promesse) => ne fonctionne pas sous IE et Edge
        fetch(url)
            .then(reponse => reponse.json())
            .then(data => update(uri, data, false))
            .catch(err => console.log(err));
    }

    function update(uri, data, isClicked) {
        $("#manifsModalBody").html("");
        if ((data.results && data.results.bindings.length) && !isClicked) {
            $.each(data.results.bindings, function(i, manif) {
                var lien = typeof manif.repro === "undefined" ? manif.manif.value : manif.repro.value;
                nodes.push({ titre: manif.titre.value, pub: manif.pub.value, desc: manif.desc.value, note: manif.note.value, uri: lien, uriOeuvre: uri, isJeune: manif.isJeune, clicked: false, group: "manif" });
                links.push({ source: typeof manif.repro === "undefined" ? manif.manif.value : manif.repro.value, target: uri, value: "workManifested" });
                var imgCard = !manif.isJeune ? '/img/manif.png' : '/img/manifJ.png';
                $("#manifsModalBody").append("<div class='card card-manif d-inline-block text-white' data-uri='" + lien + "' style='max-width:200px; background-color: " + coulOeuvreEnCours + "; margin:10px;'><img class='card-img-top img-rounded' src=" + imgCard + " alt='illustration manifestation'><div class='card-body'><h6 class='card-title'>" + manif.titre.value + "</h6><p class='card-text'>" + manif.desc.value + " - " + manif.pub.value + "</p><a href='" + lien + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Accéder à la ressource</a></div></div>");
            });
            dataObj = {
                nodes: nodes,
                links: links
            };
            setTimeout(function() {
                $(".card-manif").wrapAll("<div class='card-columns d-inline-block'></div>");
                $("#manifsModalTitle").html("Manifestations liées à <h1><cite><strong>" + oeuvreEnCours + "</strong></cite></h1>" + data.results.bindings.length + " documents").css('background-color', coulOeuvreEnCours).css('color', '#fff').css('padding', '10px 20px');
                $('#manifsModal').modal('show');
            }, 1200);
            renduGraph(1);
        } else if (isClicked) {
            lesManifs = data.filter(function(m) {
                return m.uriOeuvre === uri;
            });
            $.each(lesManifs, function(i, m) {
                var imgCard = !m.isJeune ? '/img/manif.png' : '/img/manifJ.png';
                $("#manifsModalBody").append("<div class='card card-manif d-inline-block text-white' data-uri='" + m.uri + "' style='max-width:200px; background-color: " + coulOeuvreEnCours + "; margin:10px;'><img class='card-img-top img-rounded' src=" + imgCard + " alt='illustration manifestation'><div class='card-body'><h6 class='card-title'>" + m.titre + "</h6><p class='card-text'>" + m.desc + " - " + m.pub + "</p><a href='" + m.uri + "' target='_blank' class='btn btn-outline-light btn-sm' style='white-space: normal;'>Accéder à la ressource</a></div></div>");
            });

            $(".card-manif").wrapAll("<div class='card-columns d-inline-block'></div>");
            $("#manifsModalTitle").html("Manifestations liées à <h1><cite><strong>" + oeuvreEnCours + "</strong></cite></h1>" + lesManifs.length + " documents").css('background-color', coulOeuvreEnCours).css('color', '#fff').css('padding', '10px 20px');
            $('#manifsModal').modal('show');
        }
    }


    function renduGraph(indexRequete) {
        //liens
        var link = gLinks
            .selectAll("line")
            .attr("class", "link")
            .data(dataObj.links);
        var linkEnter = link.enter().append("line")
            .attr("stroke-width", 1)
            .attr("stroke", function(d) { return color(d.value); });

        link = linkEnter.merge(link);

        //Noeuds
        var node = gNodes
            .attr("class", "nodes")
            .selectAll("circle")
            .data(dataObj.nodes);
        var nodeEnter = node.enter().append("circle")
            .attr("r", function(d) { return d.group == "auteur" ? 30 : d.group === "oeuvre" ? 12 : 8; })
            .attr("fill", function(d) {
                var coul = d.isJeune ? "#FDC745" : indexRequete === 1 && d.uri.indexOf('gallica') > -1 ? '#D2CFC8' : indexRequete === 0 ? color(d.titre) : "rgb(51, 102, 204)";
                return coul; //colorManifs(d.titre);
            })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        nodeEnter.on("click", function(d) {
                if (!d.clicked) { //L'oeuvre a-t-elle déjà été explorée ?
                    coulOeuvreEnCours = color(d.titre);
                    oeuvreEnCours = d.titre;
                    reqManifs(d.uri); //envoi requête manifestations
                    d.clicked = true;
                } else {
                    coulOeuvreEnCours = color(d.titre);
                    oeuvreEnCours = d.titre;
                    update(d.uri, nodes, true);
                }
            })
            .on("dblclick", function(d) {
                window.open(d.uri, "_blank");
            })
            .append("title")
            .text(function(d) {
                var title = indexRequete === 0 ? d.titre : d.titre + " - " + d.desc + " - " + d.note + " - " + d.pub;
                return title;
            });

        node = nodeEnter.merge(node);

        link.exit().remove();
        node.exit().remove();

        simulation
            .nodes(dataObj.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(dataObj.links);

        // function moveto(d) {
        //     // var dirM = indexRequete === 0 ? "M" + d.target.x + "," + d.target.y : "M" + d.source.x + "," + d.source.y;
        //     return "M" + d.target.x + "," + d.target.y;
        // }

        // function lineto(d) {
        //     // var dirM = indexRequete === 0 ? "L" + d.source.x + "," + d.source.y : "L" + d.target.x + "," + d.target.y;
        //     return "L" + d.source.x + "," + d.source.y;
        // }

        function dragstarted(d) {
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        //Fonction itération d3
        function ticked() {
            link
                .attr("x1", function(d) {
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    return d.target.y;
                });

            node
                .attr("cx", function(d) {
                    return d.x;
                })
                .attr("cy", function(d) {
                    return d.y;
                });

            // pathT
            //     .attr("d",
            //         function(d) {
            //             return moveto(d) + lineto(d);
            //         });
        }
    }

    // //Fonction pour supprimer les doublons dans le tableau des noeuds
    // function supprDoublons(myArr, prop) {
    //     return myArr.filter((obj, pos, arr) => {
    //         return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
    //     });
    // }
});